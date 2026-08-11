# -*- coding: utf-8 -*-
"""分享与二维码接口。"""
import base64
from io import BytesIO

from flask import Blueprint, request, jsonify

from ..db import get_db, now_str

bp = Blueprint('share', __name__)


@bp.route('/api/share', methods=['GET'])
def api_get_share():
    db = get_db()
    row = db.execute('SELECT * FROM share WHERE id = 1').fetchone()
    if not row:
        return jsonify({'code': 0, 'data': {
            'url': '', 'enabled': True, 'expiry': '',
            'passwordProtected': False, 'qrImage': None,
        }})
    return jsonify({'code': 0, 'data': dict(row)})


@bp.route('/api/share', methods=['PUT'])
def api_update_share():
    data = request.get_json() or {}
    db = get_db()
    db.execute('''INSERT OR REPLACE INTO share (id, template_id, url, qr_image, enabled, expiry, password, updated_at)
                  VALUES (1, ?, ?, ?, ?, ?, ?, ?)''',
               (data.get('templateId'), data.get('url', ''), data.get('qrImage', ''),
                1 if data.get('enabled', True) else 0,
                data.get('expiry', ''), data.get('password', ''), now_str()))
    db.commit()
    return jsonify({'code': 0, 'data': True})


@bp.route('/api/share/qrcode', methods=['POST'])
def api_qrcode():
    """生成 QR 码 base64（纯 python 实现，避免额外依赖）。"""
    import qrcode
    from qrcode.image.pure import PyPNGImage
    data = request.get_json() or {}
    url = data.get('url') or ''
    if not url:
        return jsonify({'code': 1, 'message': 'URL 不能为空'}), 400
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1a2634", back_color="white", image_factory=PyPNGImage)
    buf = BytesIO()
    img.save(buf)
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    return jsonify({'code': 0, 'data': {'image': f'data:image/png;base64,{b64}', 'url': url}})
