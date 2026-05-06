(function () {
    const container = document.getElementById('notif-container');

    function esc(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function dismiss(el) {
        el.classList.add('notif-out');
        setTimeout(() => el.remove(), 280);
    }

    const _pendingRequests = new Map();

    function showFriendRequest(fromId, fromUsername) {
        if (_pendingRequests.has(fromId)) return;

        const el = document.createElement('div');
        el.className = 'notif';
        el.innerHTML = `
            <div class="notif-avatar">${esc(fromUsername[0].toUpperCase())}</div>
            <div class="notif-body">
                <div class="notif-title">${esc(fromUsername)}</div>
                <div class="notif-sub">wants to be your friend</div>
                <div class="notif-actions">
                    <button class="notif-btn notif-accept">Accept</button>
                    <button class="notif-btn notif-decline">Decline</button>
                </div>
            </div>
        `;

        _pendingRequests.set(fromId, el);

        const acceptBtn  = el.querySelector('.notif-accept');
        const declineBtn = el.querySelector('.notif-decline');

        function setLoading() {
            acceptBtn.disabled  = true;
            declineBtn.disabled = true;
            acceptBtn.textContent = '...';
        }

        acceptBtn.addEventListener('click', async () => {
            setLoading();
            const r = await fetch('/api/friends/requests/incoming');
            const reqs = await r.json().catch(() => []);
            const req = reqs.find(x => x.from_user_id === fromId);
            if (req) {
                const res = await fetch(`/api/friends/accept/${req.id}`, { method: 'POST' });
                if (res.ok) {
                    _pendingRequests.delete(fromId);
                    dismiss(el);
                    showFriendAccepted(fromUsername);
                    window._mpSetFriendStatus?.(fromId, 'friends');
                    return;
                }
            }
            acceptBtn.disabled  = false;
            declineBtn.disabled = false;
            acceptBtn.textContent = 'Accept';
        });

        declineBtn.addEventListener('click', async () => {
            declineBtn.disabled = true;
            acceptBtn.disabled  = true;
            _pendingRequests.delete(fromId);
            dismiss(el);

            const r = await fetch('/api/friends/requests/incoming').catch(() => null);
            if (!r?.ok) return;
            const reqs = await r.json().catch(() => []);
            const req = reqs.find(x => x.from_user_id === fromId);
            if (req) fetch(`/api/friends/reject/${req.id}`, { method: 'POST' }).catch(() => {});
        });

        container.appendChild(el);
    }

    function dismissFriendRequest(fromId) {
        const el = _pendingRequests.get(fromId);
        if (el) {
            _pendingRequests.delete(fromId);
            dismiss(el);
        }
    }

    function showFriendAccepted(byUsername) {
        const el = document.createElement('div');
        el.className = 'notif notif-success';
        el.innerHTML = `
            <div class="notif-avatar notif-avatar-success">✓</div>
            <div class="notif-body">
                <div class="notif-title">You're friends!</div>
                <div class="notif-sub">You and ${esc(byUsername)} are now friends.</div>
            </div>
        `;
        container.appendChild(el);
        setTimeout(() => dismiss(el), 6000);
    }

    function showSimple(text) {
        const el = document.createElement('div');
        el.className = 'notif notif-success';
        el.innerHTML = `
            <div class="notif-body">
                <div class="notif-title">${esc(text)}</div>
            </div>
        `;
        container.appendChild(el);
        setTimeout(() => dismiss(el), 5000);
    }

    window.Notifications = {
        friendRequest: showFriendRequest,
        friendRequestCancelled: dismissFriendRequest,
        friendAccepted: showFriendAccepted,
        followed:   (name) => showSimple(`${name} followed you`),
        unfollowed: (name) => showSimple(`${name} unfollowed you`),
    };
})();
