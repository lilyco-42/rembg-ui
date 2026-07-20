"""Sponsor & Tutorial Module - Frontend UI Snippet (embeddable into any HTML)"""

MODAL_CSS = """
.sponsor-modal-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    z-index: 9999; justify-content: center; align-items: center; backdrop-filter: blur(4px);
}
.sponsor-modal-overlay.active { display: flex; }
.sponsor-modal {
    background: var(--bg-card, #16213e); border: 1px solid var(--border, #2a2a4a);
    border-radius: 14px; width: 460px; max-width: 92vw; max-height: 88vh;
    overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    animation: sponsorIn 0.25s ease;
}
@keyframes sponsorIn {
    from { opacity: 0; transform: scale(0.95) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}
.sponsor-header {
    display: flex; justify-content: space-between; align-items: center; padding: 18px 22px 0;
}
.sponsor-header h2 { font-size: 18px; font-weight: 700; color: var(--accent, #e94560); margin: 0; }
.sponsor-close {
    background: none; border: none; color: var(--text-dim, #8892a0);
    font-size: 22px; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: all 0.2s;
}
.sponsor-close:hover { background: rgba(255,255,255,0.08); color: var(--text, #eee); }
.sponsor-body { padding: 18px 22px 22px; }
.sponsor-qr-section { text-align: center; margin-bottom: 18px; }
.sponsor-qr-section canvas, .sponsor-qr-section img {
    border-radius: 10px; border: 3px solid var(--border, #2a2a4a); margin-bottom: 10px;
}
.sponsor-qr-label { font-size: 13px; color: var(--text-dim, #8892a0); }
.sponsor-actions { display: flex; gap: 10px; margin-bottom: 18px; }
.sponsor-btn {
    flex: 1; padding: 10px 14px; border: none; border-radius: 8px;
    font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    display: flex; align-items: center; justify-content: center; gap: 6px;
}
.sponsor-btn-copy { background: var(--accent, #e94560); color: white; }
.sponsor-btn-copy:hover { filter: brightness(1.15); }
.sponsor-btn-save {
    background: var(--bg-input, #0f3460); color: var(--text, #eee);
    border: 1px solid var(--border, #2a2a4a);
}
.sponsor-btn-save:hover { border-color: var(--accent, #e94560); }
.sponsor-tutorials { margin-top: 4px; }
.sponsor-tutorials .st-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; color: var(--text-dim, #8892a0); margin-bottom: 10px;
}
.sponsor-tutorial-link {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    background: var(--bg-input, #0f3460); border: 1px solid var(--border, #2a2a4a);
    border-radius: 8px; color: var(--text, #eee); text-decoration: none;
    font-size: 13px; cursor: pointer; transition: all 0.2s; margin-bottom: 8px;
}
.sponsor-tutorial-link:hover { border-color: var(--accent, #e94560); background: rgba(233,69,96,0.08); }
.sponsor-tutorial-icon {
    width: 32px; height: 32px; border-radius: 6px;
    background: var(--accent, #e94560); color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; flex-shrink: 0;
}
.sponsor-tutorial-info { flex: 1; }
.sponsor-tutorial-title { font-weight: 600; }
.sponsor-tutorial-desc { font-size: 11px; color: var(--text-dim, #8892a0); margin-top: 2px; }
.sponsor-tutorial-arrow { color: var(--text-dim, #8892a0); font-size: 12px; }
.sponsor-footer {
    text-align: center; padding-top: 14px; border-top: 1px solid var(--border, #2a2a4a);
    font-size: 11px; color: var(--text-dim, #8892a0);
}
.sponsor-footer a { color: var(--accent, #e94560); text-decoration: none; }
.sponsor-footer a:hover { text-decoration: underline; }
"""

SPONSOR_QR_CDN = '<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>'


def build_modal_html(config):
    """Generate the modal HTML from a SponsorConfig"""
    tutorials_html = ""
    for t in config.tutorials:
        tutorials_html += f"""
        <a class="sponsor-tutorial-link" onclick="openTutorial('{t.url}')">
            <div class="sponsor-tutorial-icon">{t.icon}</div>
            <div class="sponsor-tutorial-info">
                <div class="sponsor-tutorial-title">{t.title}</div>
                <div class="sponsor-tutorial-desc">点击在系统浏览器中打开</div>
            </div>
            <div class="sponsor-tutorial-arrow">&#9656;</div>
        </a>"""

    repo_link = ""
    if config.project_repo:
        repo_link = f' <a href="#" onclick="openTutorial(\'{config.project_repo}\')">GitHub</a>'

    return f"""
<div class="sponsor-modal-overlay" id="sponsorModalOverlay" onclick="if(event.target===this)closeSponsorModal()">
    <div class="sponsor-modal">
        <div class="sponsor-header">
            <h2>赞助与教程</h2>
            <button class="sponsor-close" onclick="closeSponsorModal()">&times;</button>
        </div>
        <div class="sponsor-body">
            <div class="sponsor-qr-section">
                <div id="sponsorQR"></div>
                <div class="sponsor-qr-label">扫码赞助 {config.project_name}</div>
            </div>
            <div class="sponsor-actions">
                <button class="sponsor-btn sponsor-btn-copy" id="sponsorCopyBtn" onclick="copySponsorLink()">
                    复制赞助链接
                </button>
                <button class="sponsor-btn sponsor-btn-save" onclick="saveQRCode()">
                    保存二维码
                </button>
            </div>
            <div class="sponsor-tutorials">
                <div class="st-label">教程</div>
                {tutorials_html}
            </div>
            <div class="sponsor-footer">
                {config.project_name} v{config.project_version}{repo_link}
            </div>
        </div>
    </div>
</div>"""


def build_modal_js(config):
    """Generate the modal JavaScript from a SponsorConfig"""
    return f"""
(function() {{
    var API = '/api/sponsor';
    var SPONSOR_URL = '{config.sponsor_url}';
    var SPONSOR_QR = '{config.sponsor_qr_url}';

    window.openSponsorModal = function() {{
        document.getElementById('sponsorModalOverlay').classList.add('active');
        if (typeof QRCode !== 'undefined') {{
            var el = document.getElementById('sponsorQR');
            el.innerHTML = '';
            new QRCode(el, {{
                text: SPONSOR_QR || SPONSOR_URL,
                width: 180, height: 180,
                colorDark: '#eeeeee', colorLight: '#16213e',
                correctLevel: QRCode.CorrectLevel.M
            }});
        }}
    }};

    window.closeSponsorModal = function() {{
        document.getElementById('sponsorModalOverlay').classList.remove('active');
    }};

    window.copySponsorLink = async function() {{
        try {{
            await navigator.clipboard.writeText(SPONSOR_URL);
            var btn = document.getElementById('sponsorCopyBtn');
            btn.textContent = '已复制';
            setTimeout(function() {{ btn.innerHTML = '复制赞助链接'; }}, 1500);
        }} catch(e) {{
            prompt('请手动复制链接：', SPONSOR_URL);
        }}
    }};

    window.saveQRCode = async function() {{
        var canvas = document.querySelector('#sponsorQR canvas');
        if (!canvas) {{ alert('二维码尚未生成'); return; }}
        var base64 = canvas.toDataURL('image/png');
        try {{
            var res = await fetch(API + '/save-file', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{ base64_data: base64, filename: 'sponsor_qr.png' }})
            }});
            var data = await res.json();
            if (data.success) alert('二维码已保存到: ' + data.path);
        }} catch(e) {{ alert('保存失败'); }}
    }};

    window.openTutorial = async function(url) {{
        try {{
            await fetch(API + '/open-external', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/x-www-form-urlencoded' }},
                body: 'url=' + encodeURIComponent(url)
            }});
        }} catch(e) {{
            window.open(url, '_blank');
        }}
    }};
}})();
"""
