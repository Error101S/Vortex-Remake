(function () {
    const panelEl      = document.getElementById('leaderboard');
    const bodyEl       = document.getElementById('lb-body');
    const colHeadersEl = document.getElementById('lb-col-headers');
    const friendPanel  = document.getElementById('lb-player-panel');
    const lbpName      = document.getElementById('lbp-name');
    const lbpBtn       = document.getElementById('lbp-action-btn');
    const lbpFollowBtn = document.getElementById('lbp-follow-btn');
    const lbpProfile   = document.getElementById('lbp-profile-link');

    let myId           = null;
    let columns        = [];
    let players        = [];
    let visible        = true;
    let selectedId     = null;
    let friendStatuses = {};
    let followStatuses = {};

    const FRIEND_SVG = `<i class="fa-solid fa-user lb-friend-icon"></i>`;
    const STAFF_ICON = `<i class="fa-solid fa-shield-halved lb-staff-icon"></i>`;

    function render() {
        colHeadersEl.innerHTML = '';
        for (const col of columns) {
            const th = document.createElement('span');
            th.className = 'lb-col-label';
            th.textContent = col.label;
            colHeadersEl.appendChild(th);
        }

        bodyEl.innerHTML = '';
        for (const p of players) {
            const isSelf = p.id === myId;
            const status = friendStatuses[p.id];

            const row = document.createElement('div');
            row.className = 'lb-row' + (isSelf ? ' lb-self' : ' lb-clickable');
            if (!isSelf) row.dataset.playerId = p.id;

            const nameWrap = document.createElement('span');
            nameWrap.className = 'lb-name';
            const escaped = p.username.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            if (!isSelf && status === 'friends') {
                nameWrap.innerHTML = FRIEND_SVG + ' ' + escaped;
            } else if (p.is_staff) {
                nameWrap.innerHTML = STAFF_ICON + ' ' + escaped;
            } else {
                nameWrap.textContent = p.username;
            }
            row.appendChild(nameWrap);

            for (const col of columns) {
                const val = document.createElement('span');
                val.className = 'lb-col-val';
                val.textContent = p[col.key] != null ? p[col.key] : '—';
                row.appendChild(val);
            }

            bodyEl.appendChild(row);
        }
    }

    function applyFollowStatus(status, id) {
        followStatuses[id] = status;
        lbpFollowBtn.onclick = null;
        lbpFollowBtn.disabled = false;
        if (status === 'following') {
            lbpFollowBtn.textContent = 'Following';
            lbpFollowBtn.className = 'lbp-btn lbp-following';
            lbpFollowBtn.onclick = async () => {
                lbpFollowBtn.disabled = true;
                lbpFollowBtn.textContent = '...';
                const res = await fetch(`/api/follow/${id}`, { method: 'DELETE' });
                if (selectedId !== id) return;
                if (res.ok) applyFollowStatus('not_following', id);
                else applyFollowStatus('following', id);
            };
        } else {
            lbpFollowBtn.textContent = 'Follow';
            lbpFollowBtn.className = 'lbp-btn lbp-add';
            lbpFollowBtn.onclick = async () => {
                lbpFollowBtn.disabled = true;
                lbpFollowBtn.textContent = '...';
                const res = await fetch(`/api/follow/${id}`, { method: 'POST' });
                if (selectedId !== id) return;
                if (res.ok) applyFollowStatus('following', id);
                else applyFollowStatus('not_following', id);
            };
        }
    }

    function selectPlayer(id) {
        if (selectedId === id) {
            selectedId = null;
            friendPanel.style.display = 'none';
            return;
        }
        selectedId = id;
        const p = players.find(x => x.id === id);
        lbpName.textContent = p?.username ?? '';
        lbpProfile.href = `/users/${id}/profile`;
        friendPanel.style.display = '';
        applyFriendStatus(friendStatuses[id] ?? 'none', id);
        if (followStatuses[id] != null) {
            applyFollowStatus(followStatuses[id], id);
        } else {
            lbpFollowBtn.textContent = '...';
            lbpFollowBtn.className = 'lbp-btn';
            lbpFollowBtn.disabled = true;
            fetch(`/api/follow/${id}`).then(r => r.ok ? r.json() : null).then(data => {
                if (selectedId !== id || !data) return;
                applyFollowStatus(data.status, id);
            });
        }
    }

    function applyFriendStatus(status, id) {
        friendStatuses[id] = status;
        lbpBtn.onclick = null;
        lbpBtn.disabled = false;
        if (status === 'none') {
            lbpBtn.textContent = 'Add Friend';
            lbpBtn.className = 'lbp-btn lbp-add';
            lbpBtn.onclick = async () => {
                lbpBtn.disabled = true;
                lbpBtn.textContent = '...';
                const res = await fetch(`/api/friends/request/${id}`, { method: 'POST' });
                const data = await res.json().catch(() => ({}));
                if (selectedId !== id) return;
                if (res.ok) {
                    if (data.result === 'accepted') {
                        applyFriendStatus('friends', id);
                        window._mpSetFriendStatus?.(id, 'friends');
                        window.Notifications?.friendAccepted(data.target_username);
                    } else {
                        applyFriendStatus('request_sent', id);
                        window._mpSetFriendStatus?.(id, 'request_sent');
                    }
                    render();
                } else {
                    applyFriendStatus('none', id);
                }
            };
        } else if (status === 'friends') {
            lbpBtn.textContent = 'Friends ✓';
            lbpBtn.className = 'lbp-btn lbp-friends';
        } else if (status === 'request_sent') {
            lbpBtn.textContent = 'Cancel Request';
            lbpBtn.className = 'lbp-btn lbp-pending';
            lbpBtn.onclick = async () => {
                lbpBtn.disabled = true;
                lbpBtn.textContent = '...';
                const res = await fetch(`/api/friends/request/${id}`, { method: 'DELETE' });
                if (selectedId !== id) return;
                if (res.ok) {
                    applyFriendStatus('none', id);
                    window._mpSetFriendStatus?.(id, 'none');
                    render();
                } else {
                    applyFriendStatus('request_sent', id);
                }
            };
        } else if (status === 'request_received') {
            lbpBtn.textContent = 'Accept Request';
            lbpBtn.className = 'lbp-btn lbp-add';
            lbpBtn.onclick = async () => {
                lbpBtn.disabled = true;
                lbpBtn.textContent = '...';
                const r = await fetch('/api/friends/requests/incoming');
                const reqs = await r.json().catch(() => []);
                const req = reqs.find(x => x.from_user_id === id);
                if (selectedId !== id) return;
                if (req) {
                    const res = await fetch(`/api/friends/accept/${req.id}`, { method: 'POST' });
                    if (res.ok) {
                        applyFriendStatus('friends', id);
                        window._mpSetFriendStatus?.(id, 'friends');
                        window.Notifications?.friendAccepted(lbpName.textContent);
                        render();
                        return;
                    }
                }
                applyFriendStatus('request_received', id);
            };
        }
    }

    document.addEventListener('keydown', e => {
        if (e.code === 'Tab') {
            e.preventDefault();
            visible = !visible;
            panelEl.style.display = visible ? '' : 'none';
            if (!visible) { selectedId = null; friendPanel.style.display = 'none'; }
        }
    });

    window.Leaderboard = {
        setMyId(id)       { myId = id; render(); },
        setColumns(cols)  { columns = cols; render(); },
        setPlayers(ps)    { players = [...ps]; render(); },
        addPlayer(p) {
            const i = players.findIndex(x => x.id === p.id);
            if (i >= 0) players[i] = p; else players.push(p);
            render();
        },
        removePlayer(id) {
            players = players.filter(p => p.id !== id);
            if (selectedId === id) { selectedId = null; friendPanel.style.display = 'none'; }
            render();
        },
        updateStat(id, key, value) {
            const p = players.find(x => x.id === id);
            if (p) { p[key] = value; render(); }
        },
        batchUpdateStat(updates) {
            for (const { id, key, value } of updates) {
                const p = players.find(x => x.id === id);
                if (p) p[key] = value;
            }
            render();
        },
        setFriendStatuses(map) {
            friendStatuses = { ...friendStatuses, ...map };
            render();
        },
        setFriendStatus(id, status) {
            friendStatuses[id] = status;
            render();
        },
        setFollowStatus(id, status) {
            followStatuses[id] = status;
            if (selectedId === id) applyFollowStatus(status, id);
        },
        selectPlayer,
        closeFriendPanel() { selectedId = null; friendPanel.style.display = 'none'; },
        show() { visible = true;  panelEl.style.display = ''; },
        hide() { visible = false; panelEl.style.display = 'none'; },
    };
})();
