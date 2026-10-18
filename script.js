// PART 3: Viu v6.0 Pro Max Application Engine
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
    import { getDatabase, ref, onValue, set, remove, push } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
      databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT_ID.appspot.com",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
    };

    let app, db, isFirebaseActive = false;
    let DB = JSON.parse(localStorage.getItem('viu_local_db_v5')) || { users: {}, posts: {}, stories: {}, messages: {}, typing: {}, notifications: {}, notes: {}, calls: {} };
    let currentUser = localStorage.getItem('viu_auth_user') || null;
    let currentChatTarget = null, activeTab = 'feed', feedFilter = 'all', activeHashtag = null, profileSubTab = 'my', exploreSubTab = 'users', uploadType = 'post';
    let rawUploadImageBase64 = null, currentImageBase64 = null, multiImagesList = [], carouselIdx = {};
    let activeCommentPostId = null, activeStoryId = null, viewingProfileUser = null, replyToText = null;
    let storyTimer = null, storyInterval = null, typingTimeout = null;
    let mediaRecorder = null, audioChunks = [], isRecording = false;
    let burnModeActive = false, dndModeActive = false, activeArSticker = '';

    let peerConnection = null, localStream = null, activeCallId = null, incomingCallData = null, callTimerInt = null;
    const rtcServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

    let audioCtx = null, synthInterval = null, currentPlayingTrack = null;
    window.playSynthTrack = (title) => {
      if (audioCtx && currentPlayingTrack === title) {
        window.stopSynthTrack(true);
        return;
      }
      window.stopSynthTrack(false);
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        currentPlayingTrack = title;
        const notes = title.includes('Phonky') ? [110, 130.81, 146.83, 164.81] : (title.includes('Lo-Fi') ? [220, 261.63, 329.63, 392.00] : [146.83, 196.00, 220.00, 261.63]);
        let idx = 0;
        synthInterval = setInterval(() => {
          if(!audioCtx) return;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = title.includes('Phonky') ? 'sawtooth' : 'sine';
          osc.frequency.setValueAtTime(notes[idx % notes.length], audioCtx.currentTime);
          gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
          osc.connect(gain); gain.connect(audioCtx.destination);
          osc.start(); osc.stop(audioCtx.currentTime + 0.38);
          idx++;
        }, 280);
        const fBar = document.getElementById('floating-music-bar');
        const fTitle = document.getElementById('floating-music-title');
        if(fBar && fTitle) { fTitle.innerText = title; fBar.classList.remove('hidden'); }
        window.showToast(`Now Playing: ${title} (Dobara tap karein band karne ke liye) 🎵`);
      } catch(e) {}
    };
    window.stopSynthTrack = (showMsg = false) => {
      if(synthInterval) { clearInterval(synthInterval); synthInterval = null; }
      if(audioCtx) { try { audioCtx.close(); } catch(e){} audioCtx = null; }
      currentPlayingTrack = null;
      const fBar = document.getElementById('floating-music-bar');
      if(fBar) fBar.classList.add('hidden');
      if(showMsg) window.showToast("Music Stopped 🔇");
    };

    let tttBoard = ['', '', '', '', '', '', '', '', ''];
    let tttTurn = 'X';
    window.renderTTT = () => {
      const b = document.getElementById('ttt-board');
      if(!b) return;
      b.innerHTML = tttBoard.map((cell, idx) => `<button onclick="window.makeTTTMove(${idx})" class="aspect-square bg-black border theme-border text-lg font-bold rounded-xl flex items-center justify-center text-white">${cell}</button>`).join('');
    };
    window.makeTTTMove = (idx) => {
      if(tttBoard[idx] !== '' || tttTurn !== 'X') return;
      tttBoard[idx] = 'X';
      window.renderTTT();
      if(checkTTTWine('X')) { document.getElementById('ttt-status').innerText = "Aap jeet gaye! 🎉 (+50 XP)"; apiSet(`users/${currentUser}/xpBonus`, (DB.users[currentUser]?.xpBonus || 0) + 50); return; }
      if(!tttBoard.includes('')) { document.getElementById('ttt-status').innerText = "Match Draw!"; return; }
      tttTurn = 'O';
      document.getElementById('ttt-status').innerText = "AI thinking...";
      setTimeout(() => {
        const emptyIdxs = tttBoard.map((v, i) => v === '' ? i : null).filter(v => v !== null);
        if(emptyIdxs.length > 0) {
          const aiMove = emptyIdxs[Math.floor(Math.random() * emptyIdxs.length)];
          tttBoard[aiMove] = 'O';
          window.renderTTT();
          if(checkTTTWine('O')) { document.getElementById('ttt-status').innerText = "AI Bot jeet gaya! 🤖"; tttTurn = 'X'; return; }
        }
        tttTurn = 'X';
        document.getElementById('ttt-status').innerText = "Your turn (X)";
      }, 400);
    };
    function checkTTTWine(p) {
      const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      return wins.some(w => tttBoard[w[0]] === p && tttBoard[w[1]] === p && tttBoard[w[2]] === p);
    }
    window.resetTTT = () => { tttBoard = ['', '', '', '', '', '', '', '', '']; tttTurn = 'X'; document.getElementById('ttt-status').innerText = "Your turn (X)"; window.renderTTT(); };

    window.toggleDNDMode = () => {
      dndModeActive = !dndModeActive;
      const btn = document.getElementById('dndToggleBtn');
      btn.innerText = dndModeActive ? 'ON' : 'OFF';
      btn.className = dndModeActive ? 'px-3 py-1.5 rounded-lg font-bold bg-amber-500/20 text-amber-400' : 'px-3 py-1.5 rounded-lg font-bold bg-white/10 text-gray-300';
      document.body.classList.toggle('dnd-dimmed', dndModeActive);
      window.showToast(dndModeActive ? "Focus DND Mode Enabled 🌙" : "DND Disabled");
    };

    window.applyArSticker = (sticker) => {
      activeArSticker = sticker;
      window.showToast(sticker ? `AR Sticker ${sticker} added!` : "Sticker removed");
    };

    window.openAdminModal = () => {
      const box = document.getElementById('adminUsersList');
      box.innerHTML = Object.values(DB.users || {}).map(u => `
        <div class="flex items-center justify-between p-2 rounded bg-black/40 border theme-border text-xs">
          <span>@${u.username} ${badgeHTML(u.username)}</span>
          <button onclick="window.adminDirectToggle('${u.username}')" class="bg-white/10 px-2.5 py-1 rounded">Toggle Tick</button>
        </div>`).join('');
      document.getElementById('adminModal').classList.remove('hidden');
    };
    window.adminDirectToggle = (uname) => {
      const cur = DB.users[uname]?.verified;
      apiSet(`users/${uname}/verified`, !cur);
      window.showToast(`Updated verified status for @${uname}`);
      window.openAdminModal();
    };
    window.adminToggleVerify = () => {
      const uname = document.getElementById('adminTargetUser').value.trim();
      if(!uname || !DB.users[uname]) { window.showToast("User not found!", "error"); return; }
      window.adminDirectToggle(uname);
    };

    let isDrawing = false, lastX = 0, lastY = 0;
    const canvas = document.getElementById('drawCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    if(ctx) {
      ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      canvas.addEventListener('mousedown', (e) => startDraw(e.offsetX, e.offsetY));
      canvas.addEventListener('mousemove', (e) => drawLine(e.offsetX, e.offsetY));
      window.addEventListener('mouseup', () => isDrawing = false);
      canvas.addEventListener('touchstart', (e) => { const r = canvas.getBoundingClientRect(); startDraw(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top); e.preventDefault(); });
      canvas.addEventListener('touchmove', (e) => { const r = canvas.getBoundingClientRect(); drawLine(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top); e.preventDefault(); });
    }
    function startDraw(x, y) { isDrawing = true; lastX = x; lastY = y; }
    function drawLine(x, y) {
      if(!isDrawing || !ctx) return;
      ctx.strokeStyle = document.getElementById('drawColorPicker').value;
      ctx.lineWidth = document.getElementById('drawBrushSize').value;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
      lastX = x; lastY = y;
    }
    window.clearDrawCanvas = () => { if(ctx) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height); } };
    window.fillDrawCanvas = () => { if(ctx) { ctx.fillStyle = document.getElementById('drawColorPicker').value; ctx.fillRect(0, 0, canvas.width, canvas.height); } };

    function getUserXP(u) {
      const uPosts = Object.values(normMap(DB.posts)).filter(p => p.author === u);
      const uFollowers = Object.keys(DB.users[u]?.followers || {}).length;
      let likesCount = 0;
      uPosts.forEach(p => likesCount += p.likes ? Object.keys(p.likes).length : 0);
      return (uPosts.length * 50) + (uFollowers * 30) + (likesCount * 10) + (DB.users[u]?.xpBonus || 0) + 100;
    }
    function getUserLevel(xp) { return Math.floor(Math.sqrt(xp / 150)) + 1; }

    window.showToast = (msg, type = 'info') => {
      if(dndModeActive && type !== 'error') return;
      const box = document.getElementById('toast-container');
      if (!box) return;
      const el = document.createElement('div');
      const col = type === 'error' ? 'border-rose-500 bg-rose-950/90 text-rose-200' : 'theme-border theme-surface text-white';
      el.className = `px-4 py-2 rounded-full border ${col} text-xs font-bold shadow-lg fade-in flex items-center gap-2`;
      el.innerHTML = `<span>${type === 'error' ? '⚠️' : '✨'}</span> <span>${msg}</span>`;
      box.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2600);
    };

    const saveLocalDB = () => {
      try {
        localStorage.setItem('viu_local_db_v5', JSON.stringify(DB));
      } catch(e) {
        console.warn('Local storage quota exceeded; keeping large media in runtime & Firebase.');
      }
    };
    document.documentElement.setAttribute('data-theme', localStorage.getItem('viu_theme') || 'ig-dark');
    window.setTheme = (t) => { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('viu_theme', t); updateUI(); };
    window.getCurrentChatTarget = () => currentChatTarget;

    try { if(firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") { app = initializeApp(firebaseConfig); db = getDatabase(app); } } catch(e) {}

    if(db) {
      onValue(ref(db, '/'), (snap) => {
        const d = snap.val() || {};
        DB = { users: d.users||{}, posts: d.posts||{}, stories: d.stories||{}, messages: d.messages||{}, typing: d.typing||{}, notifications: d.notifications||{}, notes: d.notes||{}, calls: d.calls||{} };
        isFirebaseActive = true;
        document.getElementById('db-status').innerText = '● Live Server Connected';
        document.getElementById('loginBtn').disabled = false;
        if(currentUser && DB.users[currentUser]) { document.getElementById('login-view').classList.add('hidden'); document.getElementById('app-container').classList.remove('hidden'); }
        checkIncomingCalls();
        updateUI();
      }, () => enableLocalMode());
    } else enableLocalMode();

    function enableLocalMode() {
      document.getElementById('db-status').innerHTML = '<span class="text-sky-400">● Local Mode Active</span>';
      document.getElementById('loginBtn').disabled = false;
      if(currentUser && DB.users[currentUser]) { document.getElementById('login-view').classList.add('hidden'); document.getElementById('app-container').classList.remove('hidden'); }
      updateUI();
    }

    function setNested(obj, path, val) {
      const p = path.split('/'); let cur = obj;
      for(let i=0; i<p.length-1; i++) { if(!cur[p[i]] || typeof cur[p[i]] !== 'object') cur[p[i]] = {}; cur = cur[p[i]]; }
      cur[p[p.length-1]] = val;
    }
    function delNested(obj, path) {
      const p = path.split('/'); let cur = obj;
      for(let i=0; i<p.length-1; i++) { if(!cur[p[i]]) return; cur = cur[p[i]]; }
      delete cur[p[p.length-1]];
    }
    function apiSet(path, data) { setNested(DB, path, data); saveLocalDB(); updateUI(); if(isFirebaseActive) set(ref(db, path), data); }
    function apiRemove(path) { delNested(DB, path); saveLocalDB(); updateUI(); if(isFirebaseActive) remove(ref(db, path)); }
    function apiPush(path, data) { const id = Date.now().toString() + Math.floor(Math.random()*999); apiSet(`${path}/${id}`, { ...data, id }); return id; }
    function notify(target, text) {
      if(dndModeActive) return;
      if(target && target !== currentUser && target !== 'GLOBAL_GROUP' && target !== 'ViuAI') apiPush(`notifications/${target}`, { actor: currentUser, text, timestamp: Date.now(), read: false });
    }

    function triggerViuAI(userMsg) {
      const q = userMsg.toLowerCase();
      let reply = "Main Viu AI Assistant hoon! 🤖 Aap mujhse post captions, coding tips, ya arcade games ke baare me puch sakte hain.";
      if (q.includes('caption')) reply = "✨ 'Vibe higher. #Viu #Explore'";
      else if (q.includes('game') || q.includes('arcade')) reply = "🎮 Aap bottom navigation se Arcade tab me jaakar Tic-Tac-Toe khel sakte hain!";
      setTimeout(() => { apiPush('messages', { sender: 'ViuAI', receiver: currentUser, text: reply, timestamp: Date.now(), read: currentChatTarget === 'ViuAI' }); }, 650);
    }

    setInterval(() => { if(currentUser && DB.users[currentUser]) apiSet(`users/${currentUser}/lastSeen`, Date.now()); }, 25000);
    const isUserOnline = (u) => { if(u === 'ViuAI') return true; const ls = DB.users?.[u]?.lastSeen; return ls && (Date.now() - ls < 120000); };
    const badgeHTML = (u) => {
      let b = (u === 'ViuAI' || DB.users?.[u]?.verified) ? `<span class="text-sky-400 text-[11px] ml-0.5">☑️</span>` : '';
      if (DB.users?.[u]?.vipTitle) b += `<span class="vip-tag">${DB.users[u].vipTitle}</span>`;
      return b;
    };

    function formatRichText(txt) {
      if(!txt) return '';
      return txt.replace(/#(\w+)/g, `<span onclick="event.stopPropagation(); window.setHashtagFilter('#$1')" class="theme-accent-text font-semibold cursor-pointer hover:underline">#$1</span>`)
                .replace(/@(\w+)/g, `<span onclick="event.stopPropagation(); window.openUserProfile('$1')" class="theme-accent-text font-semibold cursor-pointer hover:underline">@$1</span>`);
    }

    window.setHashtagFilter = (tag) => {
      activeHashtag = tag;
      document.getElementById('hashtagFilterBar').classList.toggle('hidden', !tag);
      if(tag) document.getElementById('activeHashtagText').innerText = tag;
      if(activeTab !== 'feed') window.switchTab('feed'); else renderFeed();
    };

    window.addThoughtNote = () => {
      const cur = DB.notes?.[currentUser]?.text || '';
      const txt = prompt("Share a 24h Thought Note (max 50 chars):", cur);
      if(txt === null) return;
      if(txt.trim() === '') apiRemove(`notes/${currentUser}`);
      else apiSet(`notes/${currentUser}`, { author: currentUser, text: txt.trim().slice(0, 50), timestamp: Date.now() });
    };

    window.openLeaderboard = () => {
      const usersList = Object.keys(DB.users || {});
      const ranked = usersList.map(u => ({ username: u, xp: getUserXP(u), level: getUserLevel(getUserXP(u)) })).sort((a,b) => b.xp - a.xp);
      document.getElementById('leaderboardList').innerHTML = ranked.map((r, idx) => `
        <div class="flex items-center justify-between p-3 rounded-xl bg-black/40 border theme-border">
          <div class="flex items-center gap-3">
            <span class="font-heading font-bold text-sm ${idx===0?'text-amber-400':(idx===1?'text-slate-300':'text-amber-700')}">#${idx+1}</span>
            ${generateAvatar(r.username, "w-9 h-9", true)}
            <div><div class="font-bold text-xs">${r.username} ${badgeHTML(r.username)}</div><div class="text-[10px] text-gray-400">Level ${r.level} • ${r.xp} XP</div></div>
          </div>
          <button onclick="document.getElementById('leaderboardModal').classList.add('hidden'); window.openUserProfile('${r.username}')" class="bg-white/10 px-3 py-1 rounded-lg text-xs font-bold">Profile</button>
        </div>`).join('') || `<div class="text-center text-gray-500 text-xs py-6">No users found.</div>`;
      document.getElementById('leaderboardModal').classList.remove('hidden');
    };

    window.openIdCardModal = () => {
      const canvasId = document.getElementById('idCardCanvas');
      const ctxId = canvasId.getContext('2d');
      const xp = getUserXP(currentUser), lvl = getUserLevel(xp);
      ctxId.fillStyle = '#0b0f19'; ctxId.fillRect(0, 0, canvasId.width, canvasId.height);
      ctxId.strokeStyle = '#00f3ff'; ctxId.lineWidth = 3; ctxId.strokeRect(5, 5, canvasId.width - 10, canvasId.height - 10);
      ctxId.fillStyle = '#00f3ff'; ctxId.font = 'bold 16px sans-serif'; ctxId.fillText('VIU CYBER ID PASS', 20, 32);
      ctxId.fillStyle = '#94a3b8'; ctxId.font = '11px sans-serif'; ctxId.fillText('SECURE NETWORK PASSPORT', 20, 50);
      ctxId.fillStyle = '#ffffff'; ctxId.font = 'bold 18px sans-serif'; ctxId.fillText(`@${currentUser}`, 20, 95);
      ctxId.fillStyle = '#38bdf8'; ctxId.font = '12px sans-serif'; ctxId.fillText(`Level: ${lvl}  |  XP: ${xp}`, 20, 118);
      ctxId.fillStyle = '#a855f7'; ctxId.font = '11px sans-serif'; ctxId.fillText(`Status: ${DB.users[currentUser]?.mood || 'Active'}`, 20, 142);
      ctxId.fillStyle = '#1e293b'; ctxId.fillRect(230, 30, 90, 120);
      ctxId.fillStyle = '#00f3ff'; ctxId.font = 'bold 36px sans-serif'; ctxId.fillText(currentUser.charAt(0).toUpperCase(), 258, 105);
      document.getElementById('downloadIdCardBtn').href = canvasId.toDataURL('image/png');
      document.getElementById('idCardModal').classList.remove('hidden');
    };

    window.exportBackupJSON = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(DB));
      const dlAnchor = document.createElement('a'); dlAnchor.setAttribute("href", dataStr); dlAnchor.setAttribute("download", `viu_backup_${Date.now()}.json`);
      document.body.appendChild(dlAnchor); dlAnchor.click(); dlAnchor.remove();
      window.showToast("Database backed up! 💾");
    };

    window.readPostCaption = (text) => {
      if(!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    };

    window.toggleBurnMode = () => {
      burnModeActive = !burnModeActive;
      const btn = document.getElementById('burnModeBtn');
      btn.className = burnModeActive ? "text-[10px] px-2 py-0.5 rounded-full border border-rose-500 bg-rose-500/20 text-rose-300 shrink-0 animate-pulse" : "text-[10px] px-2 py-0.5 rounded-full border theme-border text-gray-400 shrink-0";
      btn.innerText = burnModeActive ? "⏱️ 15s Burn: ON" : "⏱️ 15s Burn: OFF";
    };

    window.editChatMessage = (msgId, oldText) => {
      const newT = prompt("Edit message:", oldText);
      if(newT !== null && newT.trim() !== '') apiSet(`messages/${msgId}/text`, newT.trim() + " (edited)");
    };

    window.startCall = async (withVideo) => {
      if(!currentChatTarget || currentChatTarget === 'GLOBAL_GROUP' || currentChatTarget === 'ViuAI') return;
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true });
        document.getElementById('localCallVideo').srcObject = localStream;
        document.getElementById('localCallVideo').classList.toggle('hidden', !withVideo);
      } catch(e) { return; }

      document.getElementById('callModal').classList.remove('hidden');
      document.getElementById('callTypeLabel').innerText = withVideo ? '📹 VIDEO CALL' : '📞 AUDIO CALL';
      document.getElementById('callPartnerName').innerText = currentChatTarget;
      document.getElementById('callAvatarFallback').innerHTML = generateAvatar(currentChatTarget, "w-24 h-24 text-3xl", true);
      document.getElementById('callTimerText').innerText = "Ringing...";

      peerConnection = new RTCPeerConnection(rtcServers);
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      peerConnection.ontrack = (event) => { document.getElementById('remoteCallVideo').srcObject = event.streams[0]; startCallTimer(); };
      peerConnection.onicecandidate = (event) => { if (event.candidate && activeCallId) apiPush(`calls/${activeCallId}/candidates/${currentUser}`, event.candidate.toJSON()); };

      const callId = 'call_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      activeCallId = callId;
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      apiSet(`calls/${callId}`, { caller: currentUser, receiver: currentChatTarget, offer: { type: offer.type, sdp: offer.sdp }, status: 'ringing', timestamp: Date.now() });

      if (isFirebaseActive && db) {
        onValue(ref(db, `calls/${callId}`), async (snapshot) => {
          const callData = snapshot.val();
          if (callData && (callData.status === 'ended' || callData.status === 'rejected')) window.endCall();
        });
        onValue(ref(db, `calls/${callId}/answer`), async (snapshot) => {
          const answer = snapshot.val();
          if (answer && peerConnection && !peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            startCallTimer();
          }
        });
        onValue(ref(db, `calls/${callId}/candidates/${currentChatTarget}`), (snapshot) => {
          const candidates = snapshot.val();
          if (candidates) Object.values(candidates).forEach(async (cand) => { if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(cand)); });
        });
      }
    };

    function checkIncomingCalls() {
      if (!currentUser) return;
      const calls = DB.calls || {};
      let foundActive = false;
      for (const [cId, cData] of Object.entries(calls)) {
        if (activeCallId === cId && (cData.status === 'ended' || cData.status === 'rejected')) { window.endCall(); return; }
        if (cData.receiver === currentUser && cData.status === 'ringing') {
          foundActive = true;
          if (!incomingCallData || incomingCallData.id !== cId) {
            incomingCallData = { id: cId, ...cData };
            document.getElementById('incomingCallerName').innerText = cData.caller;
            document.getElementById('incomingCallerAvatar').innerHTML = generateAvatar(cData.caller, "w-20 h-20 text-2xl", true);
            document.getElementById('incomingCallModal').classList.remove('hidden');
          }
          break;
        }
      }
      if (!foundActive && incomingCallData) document.getElementById('incomingCallModal').classList.add('hidden');
    }

    window.acceptIncomingCall = async () => {
      if (!incomingCallData) return;
      activeCallId = incomingCallData.id;
      document.getElementById('incomingCallModal').classList.add('hidden');
      document.getElementById('callModal').classList.remove('hidden');
      document.getElementById('callPartnerName').innerText = incomingCallData.caller;
      document.getElementById('callAvatarFallback').innerHTML = generateAvatar(incomingCallData.caller, "w-24 h-24 text-3xl", true);

      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localCallVideo').srcObject = localStream;
      } catch(e) { localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); }

      peerConnection = new RTCPeerConnection(rtcServers);
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
      peerConnection.ontrack = (event) => { document.getElementById('remoteCallVideo').srcObject = event.streams[0]; startCallTimer(); };
      peerConnection.onicecandidate = (event) => { if (event.candidate && activeCallId) apiPush(`calls/${activeCallId}/candidates/${currentUser}`, event.candidate.toJSON()); };

      await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      apiSet(`calls/${activeCallId}/answer`, { type: answer.type, sdp: answer.sdp });
      apiSet(`calls/${activeCallId}/status`, 'connected');
      incomingCallData = null;
    };

    window.rejectIncomingCall = () => {
      if (incomingCallData) apiSet(`calls/${incomingCallData.id}/status`, 'rejected');
      document.getElementById('incomingCallModal').classList.add('hidden');
      incomingCallData = null;
    };

    function startCallTimer() {
      let sec = 0; clearInterval(callTimerInt);
      callTimerInt = setInterval(() => {
        sec++;
        document.getElementById('callTimerText').innerText = `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
      }, 1000);
    }

    window.toggleCallMic = () => {
      if (localStream && localStream.getAudioTracks()[0]) {
        const track = localStream.getAudioTracks()[0];
        track.enabled = !track.enabled;
        const btn = document.getElementById('micToggleBtn');
        if (btn) {
          btn.innerText = track.enabled ? '🎤' : '🔇';
          btn.className = track.enabled 
            ? 'w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center text-lg' 
            : 'w-12 h-12 rounded-full bg-rose-600/80 text-white flex items-center justify-center text-lg shadow-lg';
        }
        window.showToast(track.enabled ? "Mic Unmuted 🎤" : "Mic Muted 🔇");
      }
    };
    window.toggleCallCam = () => { 
      if (localStream && localStream.getVideoTracks()[0]) {
        const track = localStream.getVideoTracks()[0];
        track.enabled = !track.enabled;
        const btn = document.getElementById('camToggleBtn');
        if (btn) {
          btn.innerText = track.enabled ? '📷' : '🚫';
          btn.className = track.enabled 
            ? 'w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center text-lg' 
            : 'w-12 h-12 rounded-full bg-rose-600/80 text-white flex items-center justify-center text-lg shadow-lg';
        }
        window.showToast(track.enabled ? "Camera On 📷" : "Camera Off 🚫");
      }
    };
    window.endCall = () => {
      const micBtn = document.getElementById('micToggleBtn');
      if (micBtn) { micBtn.innerText = '🎤'; micBtn.className = 'w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center text-lg'; }
      const camBtn = document.getElementById('camToggleBtn');
      if (camBtn) { camBtn.innerText = '📷'; camBtn.className = 'w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center text-lg'; }
      document.getElementById('callModal').classList.add('hidden');
      document.getElementById('incomingCallModal').classList.add('hidden');
      clearInterval(callTimerInt);
      if(localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
      if(peerConnection) { peerConnection.close(); peerConnection = null; }
      if(activeCallId) { apiSet(`calls/${activeCallId}/status`, 'ended'); activeCallId = null; }
      incomingCallData = null;
    };

    window.toggleBlockUser = (target) => {
      if(!target || target === currentUser) return;
      const isB = DB.users[currentUser]?.blocked && DB.users[currentUser].blocked[target];
      if(isB) apiRemove(`users/${currentUser}/blocked/${target}`); else apiSet(`users/${currentUser}/blocked/${target}`, true);
      window.openUserProfile(target);
    };

    function compressImage(file, maxW, cb) {
      const r = new FileReader();
      r.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); let w = img.width, h = img.height;
          if(w > maxW) { h = Math.round((maxW/w)*h); w = maxW; }
          c.width = w; c.height = h;
          const ctxImg = c.getContext('2d');
          ctxImg.drawImage(img, 0, 0, w, h);
          if(activeArSticker) {
            ctxImg.font = '48px sans-serif';
            ctxImg.fillText(activeArSticker, w / 2 - 24, 60);
          }
          cb(c.toDataURL('image/jpeg', 0.65));
        };
        img.src = e.target.result;
      };
      r.readAsDataURL(file);
    }

    window.applyImageFilter = (type) => {
      if(!rawUploadImageBase64) return;
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const ctxImg = c.getContext('2d');
        const map = { vivid: 'contrast(1.25) saturate(1.45)', bw: 'grayscale(100%) contrast(1.15)', cyber: 'hue-rotate(170deg) saturate(1.6)', vintage: 'sepia(65%) contrast(1.1)', none: 'none' };
        ctxImg.filter = map[type] || 'none'; ctxImg.drawImage(img, 0, 0);
        if(activeArSticker) { ctxImg.font = '48px sans-serif'; ctxImg.fillText(activeArSticker, c.width / 2 - 24, 60); }
        currentImageBase64 = c.toDataURL('image/jpeg', 0.7);
        if(multiImagesList.length > 0) multiImagesList[0] = currentImageBase64;
        document.getElementById('imagePreview').src = currentImageBase64;
      };
      img.src = rawUploadImageBase64;
    };

    const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const normMap = (obj) => { const o = {}; if(obj) Object.entries(obj).forEach(([k,v]) => { if(v && typeof v === 'object') o[k] = { ...v, id: k }; }); return o; };

    function generateAvatar(u, cls = "w-8 h-8", showOnline = false) {
      if(!u) return '';
      if(u === 'GLOBAL_GROUP') return `<div class="inline-flex ${cls} rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 items-center justify-center text-white font-bold text-xs shrink-0">🌐</div>`;
      if(u === 'ViuAI') return `<div class="inline-flex ${cls} rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-600 items-center justify-center text-white font-bold text-xs shrink-0">🤖</div>`;
      const usr = DB.users && DB.users[u];
      const dot = (showOnline && isUserOnline(u)) ? `<span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-black rounded-full"></span>` : '';
      if(usr && usr.avatar && usr.avatar.startsWith('data:image')) return `<div class="relative inline-flex ${cls} shrink-0"><img src="${usr.avatar}" class="w-full h-full rounded-full object-cover border border-white/20">${dot}</div>`;
      const cols = ['#f43f5e', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899'];
      return `<div class="relative inline-flex ${cls} rounded-full items-center justify-center text-white font-bold text-xs shrink-0" style="background:${cols[(u.charCodeAt(0)||0)%cols.length]}">${u.charAt(0).toUpperCase()}${dot}</div>`;
    }

    window.stepCarousel = (postId, dir) => {
      const p = DB.posts[postId]; if(!p || !p.images) return;
      carouselIdx[postId] = ((carouselIdx[postId] || 0) + dir + p.images.length) % p.images.length;
      renderFeed();
    };

    window.openLikesModal = (postId) => {
      const p = DB.posts[postId]; if(!p) return;
      const listIds = Object.keys(p.likes || {});
      document.getElementById('followListTitle').innerText = `❤️ Liked By (${listIds.length})`;
      document.getElementById('followListContainer').innerHTML = listIds.length ? listIds.map(uname => `<div class="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border theme-border"><div class="flex items-center gap-2.5 cursor-pointer" onclick="document.getElementById('followListModal').classList.add('hidden'); window.openUserProfile('${uname}')">${generateAvatar(uname, "w-9 h-9", true)}<span class="font-bold text-xs">${uname} ${badgeHTML(uname)}</span></div><button onclick="document.getElementById('followListModal').classList.add('hidden'); window.openChat('${uname}')" class="bg-white/10 px-3 py-1 rounded-lg text-xs font-bold">Chat</button></div>`).join('') : `<div class="text-center text-gray-500 text-xs py-8">No likes yet.</div>`;
      document.getElementById('followListModal').classList.remove('hidden');
    };

    window.openSinglePost = (postId) => {
      const p = DB.posts[postId]; if(!p) return;
      document.getElementById('sp-author').innerText = `@${p.author}`;
      const imgEl = document.getElementById('sp-img');
      const vidEl = document.getElementById('sp-video');
      if(p.video) {
        imgEl.classList.add('hidden');
        vidEl.src = p.video;
        vidEl.classList.remove('hidden');
        document.getElementById('sp-download').href = p.video;
      } else {
        if(vidEl) { vidEl.pause(); vidEl.classList.add('hidden'); }
        imgEl.src = p.image || '';
        imgEl.classList.remove('hidden');
        document.getElementById('sp-download').href = p.image || '#';
      }
      document.getElementById('sp-likes').innerText = `❤️ ${p.likes ? Object.keys(p.likes).length : 0} likes`;
      document.getElementById('sp-caption').innerHTML = formatRichText(p.caption || '');
      document.getElementById('singlePostModal').classList.remove('hidden');
    };

    window.openInsightsModal = () => {
      const myPosts = Object.values(normMap(DB.posts)).filter(p => p.author === currentUser);
      const myStories = Object.values(normMap(DB.stories)).filter(s => s.author === currentUser);
      let totalLikes = 0, totalComments = 0, totalViews = 0;
      myPosts.forEach(p => { totalLikes += p.likes ? Object.keys(p.likes).length : 0; totalComments += p.comments ? Object.keys(p.comments).length : 0; });
      myStories.forEach(s => { totalViews += s.views ? Object.keys(s.views).length : 0; });
      document.getElementById('ins-likes').innerText = totalLikes;
      document.getElementById('ins-comments').innerText = totalComments;
      document.getElementById('ins-views').innerText = totalViews;
      document.getElementById('ins-score').innerText = `${getUserXP(currentUser)} XP`;
      document.getElementById('insightsModal').classList.remove('hidden');
    };

    window.setReplyMsg = (sender, txt) => {
      replyToText = `@${sender}: ${txt || 'Media'}`;
      document.getElementById('replyPreviewText').innerText = replyToText;
      document.getElementById('replyPreviewBar').classList.remove('hidden');
      document.getElementById('chatInput').focus();
    };
    window.cancelReply = () => { replyToText = null; document.getElementById('replyPreviewBar').classList.add('hidden'); };

    window.insertChatEmoji = (em) => {
      const inp = document.getElementById('chatInput'); inp.value += em; inp.focus();
    };

    window.clearChatHistory = () => {
      if(!currentChatTarget) return;
      if(!confirm(`Clear chat with ${currentChatTarget}?`)) return;
      Object.values(normMap(DB.messages)).forEach(m => {
        if((m.sender === currentUser && m.receiver === currentChatTarget) || (m.sender === currentChatTarget && m.receiver === currentUser)) apiRemove(`messages/${m.id}`);
      });
      window.showToast("Chat cleared 🗑️");
    };

    window.openShareModal = (postId) => {
      const box = document.getElementById('shareUsersList'); box.innerHTML = '';
      Object.values(DB.users || {}).forEach(u => {
        if(!u?.username || u.username === currentUser) return;
        box.innerHTML += `<div class="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border theme-border"><div class="flex items-center gap-2.5">${generateAvatar(u.username, "w-9 h-9", true)}<span class="font-bold text-xs">${u.username}</span></div><button onclick="window.sendPostToUser('${postId}', '${u.username}')" class="theme-accent-bg px-3 py-1.5 rounded-lg text-xs font-bold">Send ✈️</button></div>`;
      });
      document.getElementById('sharePostModal').classList.remove('hidden');
    };

    window.sendPostToUser = (postId, targetUser) => {
      const p = DB.posts[postId]; if(!p) return;
      apiPush('messages', { sender: currentUser, receiver: targetUser, text: `Shared a post by @${p.author}: "${(p.caption || '').slice(0, 40)}"`, image: p.image || null, timestamp: Date.now(), read: false });
      notify(targetUser, `shared a post with you ✈️`);
      document.getElementById('sharePostModal').classList.add('hidden');
      window.openChat(targetUser);
    };

    window.openFollowListModal = (type) => {
      const u = DB.users[currentUser] || {};
      const listIds = Object.keys((type === 'followers' ? u.followers : u.following) || {});
      document.getElementById('followListTitle').innerText = type === 'followers' ? 'Followers' : 'Following';
      document.getElementById('followListContainer').innerHTML = listIds.length ? listIds.map(uname => `<div class="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border theme-border"><div class="flex items-center gap-2.5 cursor-pointer" onclick="document.getElementById('followListModal').classList.add('hidden'); window.openUserProfile('${uname}')">${generateAvatar(uname, "w-9 h-9", true)}<span class="font-bold text-xs">${uname} ${badgeHTML(uname)}</span></div><button onclick="document.getElementById('followListModal').classList.add('hidden'); window.openChat('${uname}')" class="bg-white/10 px-3 py-1 rounded-lg text-xs font-bold">Chat</button></div>`).join('') : `<div class="text-center text-gray-500 text-xs py-8">No users yet.</div>`;
      document.getElementById('followListModal').classList.remove('hidden');
    };

    window.editPostCaption = (postId) => {
      const p = DB.posts[postId]; if(!p) return;
      const newCap = prompt("Edit caption:", p.caption || "");
      if(newCap !== null) { apiSet(`posts/${postId}/caption`, newCap.trim()); window.showToast("Caption updated!"); }
    };
    window.togglePinPost = (postId) => {
      const p = DB.posts[postId];
      if(p) { apiSet(`posts/${postId}/pinned`, !p.pinned); window.showToast("Pin toggled 📌"); }
    };

    window.toggleVoiceRecording = async () => {
      if(!currentChatTarget) return;
      const btn = document.getElementById('voiceRecordBtn');
      if(isRecording && mediaRecorder) { mediaRecorder.stop(); isRecording = false; btn.className = "p-2 rounded-full bg-white/10 text-sm shrink-0"; btn.innerText = "🎙️"; return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream); audioChunks = [];
        mediaRecorder.ondataavailable = (e) => { if(e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => apiPush('messages', { sender: currentUser, receiver: currentChatTarget, text: '🎙️ Voice Note', audio: reader.result, timestamp: Date.now(), read: false });
          reader.readAsDataURL(blob); stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start(); isRecording = true;
        btn.className = "p-2 rounded-full bg-rose-600 text-white text-xs font-bold animate-pulse shrink-0"; btn.innerText = "⏹";
      } catch(err) {}
    };

    window.votePoll = (postId, optIdx) => { const p = DB.posts[postId]; if(p) { apiSet(`posts/${postId}/pollVotes/${currentUser}`, optIdx); notify(p.author, `voted on your poll 📊`); } };

    window.sendStoryReply = () => {
      if(!activeStoryId || !DB.stories[activeStoryId]) return;
      const inp = document.getElementById('storyReplyInput'), txt = inp.value.trim(); if(!txt) return;
      const st = DB.stories[activeStoryId];
      apiPush('messages', { sender: currentUser, receiver: st.author, text: `↪️ Replied to story: "${txt}"`, timestamp: Date.now(), read: false });
      notify(st.author, `replied to your story 💬`); inp.value = ''; window.closeStoryViewer(); window.openChat(st.author);
    };

    window.toggleFollow = (target) => {
      if(!target || target === currentUser) return;
      const isF = DB.users[currentUser]?.following && DB.users[currentUser].following[target];
      if(isF) { apiRemove(`users/${currentUser}/following/${target}`); apiRemove(`users/${target}/followers/${currentUser}`); }
      else { apiSet(`users/${currentUser}/following/${target}`, true); apiSet(`users/${target}/followers/${currentUser}`, true); notify(target, 'started following you.'); window.showToast(`Following @${target}`); }
      if(viewingProfileUser === target) window.openUserProfile(target);
    };

    window.openUserProfile = (u) => {
      if(!u || u === 'GLOBAL_GROUP' || u === 'ViuAI' || !DB.users[u]) return;
      if(u === currentUser) { window.closeUserProfile(); window.switchTab('profile'); return; }
      viewingProfileUser = u;
      const usr = DB.users[u], posts = Object.values(normMap(DB.posts)).filter(p => p.author === u && p.image);
      const isF = !!(DB.users[currentUser]?.following && DB.users[currentUser].following[u]);
      const isB = !!(DB.users[currentUser]?.blocked && DB.users[currentUser].blocked[u]);
      document.getElementById('modal-prof-header').innerHTML = `@${u} ${badgeHTML(u)} <span class="text-[10px] text-gray-400 ml-1">Lv.${getUserLevel(getUserXP(u))}</span>`;
      document.getElementById('modal-prof-avatar').innerHTML = generateAvatar(u, "w-16 h-16 text-xl", true);
      document.getElementById('modal-prof-posts').innerText = posts.length;
      document.getElementById('modal-prof-followers').innerText = usr.followers ? Object.keys(usr.followers).length : 0;
      document.getElementById('modal-prof-following').innerText = usr.following ? Object.keys(usr.following).length : 0;
      document.getElementById('modal-prof-bio').innerText = usr.bio || 'Available on Viu.';
      document.getElementById('modal-prof-actions').innerHTML = `
        <button onclick="window.toggleFollow('${u}')" class="flex-1 py-2 rounded-lg text-xs font-bold ${isF ? 'bg-white/15 text-white' : 'theme-accent-bg'}">${isF ? 'Following ✓' : 'Follow'}</button>
        <button onclick="window.closeUserProfile(); window.openChat('${u}')" class="flex-1 py-2 rounded-lg bg-white/10 text-xs font-bold">Message</button>
        <button onclick="window.toggleBlockUser('${u}')" class="px-3 py-2 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-bold">${isB ? 'Unblock' : '🚫'}</button>`;
      document.getElementById('modal-prof-grid').innerHTML = posts.map(p => `<div onclick="window.openSinglePost('${p.id}')" class="aspect-square bg-gray-900 rounded overflow-hidden cursor-pointer"><img src="${p.image}" class="w-full h-full object-cover"></div>`).join('') || `<div class="col-span-3 text-center text-gray-500 text-xs py-6">No photo posts yet.</div>`;
      document.getElementById('userProfileModal').classList.remove('hidden');
    };
    window.closeUserProfile = () => { document.getElementById('userProfileModal').classList.add('hidden'); viewingProfileUser = null; };

    window.openNotifications = () => {
      document.getElementById('notificationsDrawer').classList.remove('hidden');
      Object.values(normMap(DB.notifications && DB.notifications[currentUser])).forEach(n => { if(!n.read) apiSet(`notifications/${currentUser}/${n.id}/read`, true); });
      const arr = Object.values(normMap(DB.notifications && DB.notifications[currentUser])).sort((a,b) => b.timestamp - a.timestamp);
      document.getElementById('notificationsList').innerHTML = arr.map(n => `<div class="flex items-center gap-3 p-3 rounded-xl bg-black/40 border theme-border text-xs">${generateAvatar(n.actor, "w-8 h-8", true)}<div><b class="cursor-pointer" onclick="window.closeNotifications(); window.openUserProfile('${n.actor}')">${n.actor}</b> ${n.text}<div class="text-[10px] text-gray-500">${formatTime(n.timestamp)}</div></div></div>`).join('') || `<div class="text-center text-gray-500 text-xs mt-8">No notifications yet.</div>`;
    };
    window.closeNotifications = () => document.getElementById('notificationsDrawer').classList.add('hidden');
    window.clearNotifications = () => { apiRemove(`notifications/${currentUser}`); window.openNotifications(); };

    window.togglePostReaction = (postId, emoji) => {
      const p = DB.posts[postId]; if(!p) return;
      if (p.reactions?.[currentUser] === emoji) apiRemove(`posts/${postId}/reactions/${currentUser}`);
      else { apiSet(`posts/${postId}/reactions/${currentUser}`, emoji); notify(p.author, `reacted ${emoji} to your post`); }
    };

    window.toggleLike = (id) => {
      const p = DB.posts[id]; if(!p) return;
      if(p.likes && p.likes[currentUser]) apiRemove(`posts/${id}/likes/${currentUser}`);
      else { apiSet(`posts/${id}/likes/${currentUser}`, true); notify(p.author, 'liked your post ❤️'); }
    };

    window.doubleTapLike = (id) => {
      const p = DB.posts[id]; if(!p) return;
      const box = document.getElementById(`post-img-${id}`);
      if(box) { const h = document.createElement('div'); h.className = "absolute top-1/2 left-1/2 heart-pop pointer-events-none z-20 text-6xl"; h.innerText = "❤️"; box.appendChild(h); setTimeout(() => h.remove(), 750); }
      if(!(p.likes && p.likes[currentUser])) { apiSet(`posts/${id}/likes/${currentUser}`, true); notify(p.author, 'liked your post ❤️'); }
    };

    window.toggleBookmark = (id) => {
      const s = DB.users[currentUser]?.saved && DB.users[currentUser].saved[id];
      if(s) { apiRemove(`users/${currentUser}/saved/${id}`); window.showToast("Removed from Saved"); }
      else { apiSet(`users/${currentUser}/saved/${id}`, true); window.showToast("Saved 🔖"); }
    };

    window.openComments = (id) => { activeCommentPostId = id; document.getElementById('commentsDrawer').classList.remove('hidden'); window.renderCommentsList(); };
    window.closeComments = () => { document.getElementById('commentsDrawer').classList.add('hidden'); activeCommentPostId = null; };
    window.submitComment = () => {
      const inp = document.getElementById('commentInput'), txt = inp.value.trim(); if(!txt || !activeCommentPostId) return;
      apiPush(`posts/${activeCommentPostId}/comments`, { author: currentUser, text: txt, timestamp: Date.now() });
      notify(DB.posts[activeCommentPostId]?.author, `commented: "${txt.slice(0,20)}" 💬`); inp.value = '';
    };
    window.deleteComment = (cId) => { if(activeCommentPostId && cId) apiRemove(`posts/${activeCommentPostId}/comments/${cId}`); };
    window.toggleCommentLike = (cId) => {
      if(!activeCommentPostId) return;
      const comm = DB.posts[activeCommentPostId]?.comments?.[cId];
      if(!comm) return;
      const isL = comm.likes && comm.likes[currentUser];
      if(isL) apiRemove(`posts/${activeCommentPostId}/comments/${cId}/likes/${currentUser}`);
      else apiSet(`posts/${activeCommentPostId}/comments/${cId}/likes/${currentUser}`, true);
      window.renderCommentsList();
    };

    window.renderCommentsList = () => {
      if(!activeCommentPostId || !DB.posts[activeCommentPostId]) return;
      const cArr = Object.values(normMap(DB.posts[activeCommentPostId].comments));
      document.getElementById('commentsList').innerHTML = cArr.map(c => {
        const lCnt = c.likes ? Object.keys(c.likes).length : 0;
        const isLiked = c.likes && c.likes[currentUser];
        return `<div class="flex items-center justify-between text-xs">
          <div class="flex gap-2.5 items-start">${generateAvatar(c.author, "w-7 h-7")}<div><b class="mr-1.5">${c.author}</b>${badgeHTML(c.author)} <span class="text-gray-300">${formatRichText(c.text)}</span></div></div>
          <div class="flex items-center gap-2">
            <button onclick="window.toggleCommentLike('${c.id}')" class="text-[11px]">${isLiked ? '❤️' : '🤍'} ${lCnt}</button>
            ${c.author === currentUser ? `<button onclick="window.deleteComment('${c.id}')" class="text-[10px] text-rose-400">✕</button>` : ''}
          </div>
        </div>`;
      }).join('') || `<div class="text-center text-gray-500 text-xs mt-4">No comments yet.</div>`;
    };

    window.openUploadModal = (t = 'post') => { document.getElementById('uploadModal').classList.remove('hidden'); window.setUploadType(t); };
    window.closeUploadModal = () => document.getElementById('uploadModal').classList.add('hidden');
    window.setUploadType = (t) => {
      uploadType = t;
      ['post', 'reel', 'meme', 'draw', 'quote', 'story', 'poll'].forEach(k => {
        const el = document.getElementById(`type-${k}`);
        if(el) el.className = `py-1.5 rounded text-[10px] font-bold ${t===k ? 'theme-accent-bg' : 'text-gray-400'}`;
      });
      document.getElementById('photoUploadSection').classList.toggle('hidden', t === 'poll' || t === 'quote' || t === 'draw' || t === 'reel' || t === 'meme');
      const reelSec = document.getElementById('reelUploadSection');
      if(reelSec) reelSec.classList.toggle('hidden', t !== 'reel');
      const memeSec = document.getElementById('memeUploadSection');
      if(memeSec) {
        memeSec.classList.toggle('hidden', t !== 'meme');
        if(t === 'meme' && !window.memeInitialized) window.loadPresetMemeBg(0);
      }
      document.getElementById('drawPadSection').classList.toggle('hidden', t !== 'draw');
      document.getElementById('pollOptionsSection').classList.toggle('hidden', t !== 'poll');
      document.getElementById('quoteBgSection').classList.toggle('hidden', t !== 'quote');
      document.getElementById('storyMusicSection').classList.toggle('hidden', t === 'poll');
    };

    window.viewStory = (id) => {
      const s = normMap(DB.stories)[id]; if(!s) return;
      activeStoryId = id; apiSet(`stories/${id}/views/${currentUser}`, true);
      const st = DB.stories[id] || s;
      document.getElementById('storyViewerAvatar').innerHTML = generateAvatar(s.author, "w-9 h-9", true);
      document.getElementById('storyViewerName').innerHTML = `${s.author} ${badgeHTML(s.author)}`;
      document.getElementById('storyViewerTime').innerText = formatTime(s.timestamp);
      document.getElementById('storyViewerImage').src = s.image;
      const cap = document.getElementById('storyViewerCaption');
      if(s.caption) { cap.innerText = s.caption; cap.classList.remove('hidden'); } else cap.classList.add('hidden');
      const mus = document.getElementById('storyMusicBadge');
      if(s.music) { mus.innerText = s.music; mus.classList.remove('hidden'); } else mus.classList.add('hidden');
      document.getElementById('storyViewsCount').innerText = `👁️ ${st.views ? Object.keys(st.views).length : 1}`;
      document.getElementById('storyLikesCount').innerText = `❤️ ${st.likes ? Object.keys(st.likes).length : 0}`;
      document.getElementById('storyLikeIcon').innerText = (st.likes && st.likes[currentUser]) ? '❤️' : '🤍';
      const del = document.getElementById('deleteStoryBtn');
      if(s.author === currentUser) { del.classList.remove('hidden'); del.onclick = () => { apiRemove(`stories/${id}`); window.closeStoryViewer(); }; } else del.classList.add('hidden');
      document.getElementById('storyViewerModal').classList.remove('hidden');
      const bar = document.getElementById('storyProgressBar'); bar.style.width = '0%';
      let el = 0; clearInterval(storyInterval); clearTimeout(storyTimer);
      storyInterval = setInterval(() => { el += 100; bar.style.width = `${Math.min(100, (el/6000)*100)}%`; }, 100);
      storyTimer = setTimeout(window.closeStoryViewer, 6000);
    };

    window.toggleStoryLike = () => {
      if(!activeStoryId || !DB.stories[activeStoryId]) return;
      const s = DB.stories[activeStoryId];
      if(s.likes && s.likes[currentUser]) apiRemove(`stories/${activeStoryId}/likes/${currentUser}`);
      else { apiSet(`stories/${activeStoryId}/likes/${currentUser}`, true); notify(s.author, 'liked your story ❤️'); }
      window.viewStory(activeStoryId);
    };
    window.closeStoryViewer = () => { window.stopSynthTrack(false); document.getElementById('storyViewerModal').classList.add('hidden'); activeStoryId = null; clearInterval(storyInterval); clearTimeout(storyTimer); };

    document.getElementById('avatarFileInput').onchange = (e) => {
      if(e.target.files[0]) compressImage(e.target.files[0], 300, (b64) => { apiSet(`users/${currentUser}/avatar`, b64); window.showToast("Avatar Updated!"); });
    };
    document.getElementById('bannerFileInput').onchange = (e) => {
      if(e.target.files[0]) compressImage(e.target.files[0], 700, (b64) => { apiSet(`users/${currentUser}/banner`, b64); window.showToast("Cover Updated! 🖼️"); });
    };

    window.openBioModal = () => {
      const u = DB.users[currentUser] || {};
      document.getElementById('bioInput').value = u.bio || '';
      document.getElementById('moodInput').value = u.mood || '✨ Using Viu';
      document.getElementById('verifiedInput').checked = !!u.verified;
      document.getElementById('bioModal').classList.remove('hidden');
    };
    window.saveBio = () => {
      apiSet(`users/${currentUser}/bio`, document.getElementById('bioInput').value.trim());
      apiSet(`users/${currentUser}/mood`, document.getElementById('moodInput').value);
      apiSet(`users/${currentUser}/verified`, document.getElementById('verifiedInput').checked);
      document.getElementById('bioModal').classList.add('hidden');
      window.showToast("Profile Updated!");
    };
    window.setProfileSubTab = (sub) => { profileSubTab = sub; renderProfile(); };
    window.setExploreSubTab = (sub) => { exploreSubTab = sub; renderExplore(); };
    window.setFeedFilter = (f) => { feedFilter = f; renderFeed(); };

    window.switchTab = (t) => {
      if(activeTab !== t) {
        window.stopSynthTrack(false);
        document.querySelectorAll('video').forEach(v => v.pause());
      }
      activeTab = t;
      ['feed', 'reels', 'explore', 'games', 'chatlist', 'profile'].forEach(x => {
        const el = document.getElementById(`tab-${x}`);
        if(el) el.classList.toggle('hidden', x !== t);
        const btn = document.getElementById(`navbtn-${x}`);
        if(btn) btn.className = x === t ? "p-2 theme-accent-text flex flex-col items-center" : "p-2 text-gray-500 flex flex-col items-center";
      });
      updateUI();
    };

    window.openChat = (target) => {
      currentChatTarget = target; window.cancelReply();
      if(target === 'GLOBAL_GROUP') {
        document.getElementById('active-chat-name').innerHTML = `🌐 Global Lounge`;
        document.getElementById('active-chat-avatar').innerHTML = generateAvatar('GLOBAL_GROUP', "w-8 h-8");
        document.getElementById('active-chat-status').innerText = `${Object.keys(DB.users || {}).length} members`;
      } else if(target === 'ViuAI') {
        document.getElementById('active-chat-name').innerHTML = `Viu AI Assistant ${badgeHTML('ViuAI')}`;
        document.getElementById('active-chat-avatar').innerHTML = generateAvatar('ViuAI', "w-8 h-8");
        document.getElementById('active-chat-status').innerText = `● Always Active Bot`;
      } else {
        document.getElementById('active-chat-name').innerHTML = `${target} ${badgeHTML(target)}`;
        document.getElementById('active-chat-avatar').innerHTML = generateAvatar(target, "w-8 h-8", true);
        document.getElementById('active-chat-status').innerText = isUserOnline(target) ? '● Online' : '○ Offline';
      }
      document.getElementById('active-chat-view').classList.remove('hidden');
      renderMessages();
    };
    window.closeChat = () => { document.getElementById('active-chat-view').classList.add('hidden'); currentChatTarget = null; updateUI(); };
    window.reactMessage = (id, em) => apiSet(`messages/${id}/reaction`, em);
    window.deleteMessage = (id) => apiRemove(`messages/${id}`);
    window.deletePost = (id) => { if(confirm("Delete post?")) { apiRemove(`posts/${id}`); window.showToast("Post deleted"); } };
    window.logoutUser = () => { localStorage.removeItem('viu_auth_user'); location.reload(); };

    function updateUI() {
      const box = document.getElementById('existing-users'); box.innerHTML = '';
      Object.values(DB.users || {}).forEach(u => {
        if(!u?.username) return;
        const b = document.createElement('button'); b.type = "button";
        b.className = "px-2.5 py-1 theme-surface border theme-border rounded-full text-xs flex items-center gap-1 text-white";
        b.innerHTML = `${generateAvatar(u.username, "w-4 h-4 text-[9px]")}<span>${u.username}</span>`;
        b.onclick = () => { document.getElementById('usernameInput').value = u.username; document.getElementById('passwordInput').focus(); };
        box.appendChild(b);
      });

      if(!currentUser || !DB.users[currentUser]) return;
      document.getElementById('nav-username').innerHTML = `${currentUser} ${badgeHTML(currentUser)}`;
      document.getElementById('nav-avatar').innerHTML = generateAvatar(currentUser, "w-5 h-5", true);
      
      const myXP = getUserXP(currentUser), myLv = getUserLevel(myXP);
      const lvlEl = document.getElementById('profile-level-badge');
      if(lvlEl) lvlEl.innerText = `Lv.${myLv}`;

      const unreadM = Object.values(normMap(DB.messages)).filter(m => m.receiver === currentUser && !m.read).length;
      const uBadge = document.getElementById('unread-badge'); uBadge.innerText = unreadM; uBadge.classList.toggle('hidden', unreadM === 0);

      const unreadN = Object.values(normMap(DB.notifications && DB.notifications[currentUser])).filter(n => !n.read).length;
      const nBadge = document.getElementById('notif-badge'); nBadge.innerText = unreadN; nBadge.classList.toggle('hidden', nBadge === 0);

      if(activeTab === 'feed') { renderStories(); renderFeed(); }
      if(activeTab === 'reels') {
        renderReels();
        setTimeout(() => setupReelObserver(), 50);
      }
      if(activeTab === 'explore') renderExplore();
      if(activeTab === 'games') { window.renderTTT(); if(!window.memInitialized) window.initMemoryGame(); }
      const myCoins = DB.users[currentUser]?.coins ?? 100;
      const hc = document.getElementById('header-coin-count'); if(hc) hc.innerText = myCoins;
      const wc = document.getElementById('wallet-modal-coins'); if(wc) wc.innerText = myCoins;
      if(activeTab === 'chatlist') renderChatList();
      if(activeTab === 'profile') renderProfile();
      if(currentChatTarget) renderMessages();
      if(activeCommentPostId) window.renderCommentsList();
    }

    function renderStories() {
      const c = document.getElementById('stories-container');
      c.innerHTML = `<div class="flex flex-col items-center gap-1 cursor-pointer shrink-0" onclick="window.openUploadModal('story')"><div class="relative w-16 h-16 rounded-full border-2 border-dashed theme-border flex items-center justify-center">${generateAvatar(currentUser, "w-14 h-14 opacity-70")}<span class="absolute bottom-0 right-0 theme-accent-bg w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">+</span></div><span class="text-[11px] text-gray-400">Add Story</span></div>`;
      Object.values(normMap(DB.stories)).sort((a,b) => b.timestamp - a.timestamp).forEach(s => {
        if((Date.now() - s.timestamp) > 86400000) return;
        c.insertAdjacentHTML('beforeend', `<div class="flex flex-col items-center gap-1 cursor-pointer shrink-0" onclick="window.viewStory('${s.id}')"><div class="story-ring w-16 h-16 rounded-full"><img src="${s.image}" class="w-full h-full rounded-full object-cover border-2 border-black"></div><span class="text-[11px] truncate w-16 text-center">${s.author}</span></div>`);
      });
    }

    let renderedReelSignature = '';
    let reelIntersectionObserver = null;

    window.toggleReelVideoPlay = (postId) => {
      const slide = document.getElementById(`post-img-${postId}`);
      if(!slide) return;
      const vid = slide.querySelector('video');
      const ind = document.getElementById(`reel-pause-ind-${postId}`);
      if(!vid) return;
      if(vid.paused) {
        document.querySelectorAll('#reels-container video').forEach(v => { if(v !== vid) v.pause(); });
        vid.play().catch(()=>{});
        if(ind) ind.classList.add('opacity-0', 'scale-75');
      } else {
        vid.pause();
        if(ind) ind.classList.remove('opacity-0', 'scale-75');
      }
    };

    function setupReelObserver() {
      const c = document.getElementById('reels-container');
      if(!c) return;
      if(reelIntersectionObserver) reelIntersectionObserver.disconnect();

      reelIntersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const vid = entry.target.querySelector('video');
          const postId = entry.target.getAttribute('data-reel-id');
          const ind = postId ? document.getElementById(`reel-pause-ind-${postId}`) : null;
          if(entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            // Pause every other video in the entire document so upper/lower reels never play together
            document.querySelectorAll('video').forEach(otherVid => {
              if(otherVid !== vid) {
                otherVid.pause();
              }
            });
            if(vid && activeTab === 'reels') {
              vid.muted = !!window.reelsMuted;
              const spd = (typeof reelSpeeds !== 'undefined' && typeof curSpeedIdx !== 'undefined') ? reelSpeeds[curSpeedIdx] : 1;
              vid.playbackRate = spd;
              vid.play().catch(()=>{});
              if(ind) ind.classList.add('opacity-0', 'scale-75');
            }
          } else {
            if(vid) {
              vid.pause();
              vid.currentTime = 0;
            }
          }
        });
      }, { root: c, threshold: [0.15, 0.65, 0.85] });

      c.querySelectorAll('.reel-slide').forEach(slide => reelIntersectionObserver.observe(slide));
    }

    function renderReels(forceRebuild = false) {
      const c = document.getElementById('reels-container');
      if(!c) return;
      const postsArr = Object.values(normMap(DB.posts)).filter(p => p.video || p.isReel || p.image).sort((a,b) => (b.isReel ? 1 : 0) - (a.isReel ? 1 : 0) || b.timestamp - a.timestamp);
      if(postsArr.length === 0) {
        renderedReelSignature = '';
        c.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-xs text-gray-400 gap-3"><p>No Reels yet!</p><button onclick="window.openUploadModal('reel')" class="theme-accent-bg px-4 py-2 rounded-full font-bold text-xs">+ Upload First Reel</button></div>`;
        return;
      }

      const myF = DB.users[currentUser]?.following || {};
      const saved = DB.users[currentUser]?.saved || {};
      const newSignature = postsArr.map(p => `${p.id}:${p.video||p.image}`).join('|');

      // SMART IN-PLACE UPDATE: If reel list hasn't changed, update likes/comments/bookmarks/follows WITHOUT touching <video> DOM!
      if(!forceRebuild && renderedReelSignature === newSignature && c.querySelectorAll('.reel-slide').length === postsArr.length) {
        postsArr.forEach(p => {
          const likes = p.likes ? Object.keys(p.likes) : [], isL = likes.includes(currentUser);
          const cCnt = p.comments ? Object.keys(p.comments).length : 0;
          const isS = !!saved[p.id];
          const likeBtn = document.getElementById(`reel-like-btn-${p.id}`);
          const likeCnt = document.getElementById(`reel-like-cnt-${p.id}`);
          const cmtCnt = document.getElementById(`reel-cmt-cnt-${p.id}`);
          const saveBtn = document.getElementById(`reel-save-btn-${p.id}`);
          const folBtn = document.getElementById(`reel-fol-btn-${p.id}`);
          const tipCnt = document.getElementById(`reel-tip-cnt-${p.id}`);
          if(likeBtn) likeBtn.innerText = isL ? '❤️' : '🤍';
          if(likeCnt) likeCnt.innerText = likes.length;
          if(cmtCnt) cmtCnt.innerText = cCnt;
          if(saveBtn) saveBtn.innerText = isS ? '🔖' : '📑';
          if(folBtn) folBtn.innerText = myF[p.author] ? 'Following' : 'Follow';
          if(tipCnt) tipCnt.innerText = p.tips ? `${p.tips}` : 'Tip';
        });
        return;
      }

      renderedReelSignature = newSignature;
      c.innerHTML = '';

      postsArr.forEach(p => {
        const likes = p.likes ? Object.keys(p.likes) : [], isL = likes.includes(currentUser);
        const cCnt = p.comments ? Object.keys(p.comments).length : 0;
        const isS = !!saved[p.id];
        const mediaEl = p.video 
          ? `<video src="${p.video}" loop ${window.reelsMuted ? 'muted' : ''} playsinline preload="metadata" onclick="window.toggleReelVideoPlay('${p.id}')" ontimeupdate="const b=document.getElementById('reel-prog-${p.id}'); if(b && this.duration) b.style.width=((this.currentTime/this.duration)*100)+'%';" class="absolute inset-0 w-full h-full object-cover cursor-pointer"></video>
             <div id="reel-pause-ind-${p.id}" class="reel-pause-indicator opacity-0 scale-75 z-10 w-16 h-16 rounded-full bg-black/60 border border-white/30 flex items-center justify-center text-2xl text-white">⏸️</div>
             <div class="absolute bottom-14 left-0 right-0 h-1 bg-white/20 z-20 pointer-events-none"><div id="reel-prog-${p.id}" class="h-full theme-accent-bg w-0 transition-all duration-75"></div></div>`
          : `<img src="${p.image}" class="absolute inset-0 w-full h-full object-cover">`;
        const musicTitle = p.music || '🎵 Original Reel Audio - Viu';

        c.insertAdjacentHTML('beforeend', `
          <div id="post-img-${p.id}" data-reel-id="${p.id}" ondblclick="window.doubleTapLike('${p.id}')" class="reel-slide w-full h-full snap-start relative flex items-center justify-center bg-black overflow-hidden select-none">
            ${mediaEl}
            <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 pointer-events-none"></div>
            <div class="absolute bottom-16 left-4 right-16 z-10 space-y-2 pointer-events-auto">
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-2 cursor-pointer" onclick="window.openUserProfile('${p.author}')">
                  ${generateAvatar(p.author, "w-9 h-9", true)}
                  <span class="font-bold text-sm text-white">${p.author}</span> ${badgeHTML(p.author)}
                </div>
                ${p.author !== currentUser ? `<button id="reel-fol-btn-${p.id}" onclick="window.toggleFollow('${p.author}')" class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-white/50 text-white bg-black/40">${myF[p.author] ? 'Following' : 'Follow'}</button>` : `<button onclick="window.deletePost('${p.id}')" class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-rose-500/60 text-rose-300 bg-black/60">🗑️ Delete</button>`}
              </div>
              <div class="text-xs text-gray-100 line-clamp-2">${formatRichText(p.caption || '')}</div>
              <div onclick="window.playSynthTrack('${musicTitle}')" class="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 px-3 py-1 rounded-full text-[11px] text-white cursor-pointer">
                <span>🎶</span> <marquee class="w-36" scrollamount="3">${musicTitle}</marquee>
              </div>
            </div>
            <div class="absolute bottom-16 right-3 z-10 flex flex-col items-center gap-3.5">
              <div class="flex flex-col items-center">
                <button id="reel-like-btn-${p.id}" onclick="window.toggleLike('${p.id}')" class="text-2xl active:scale-125 transition">${isL ? '❤️' : '🤍'}</button>
                <span id="reel-like-cnt-${p.id}" class="text-[11px] font-bold text-white">${likes.length}</span>
              </div>
              <div class="flex flex-col items-center">
                <button onclick="window.openComments('${p.id}')" class="text-2xl">💬</button>
                <span id="reel-cmt-cnt-${p.id}" class="text-[11px] font-bold text-white">${cCnt}</span>
              </div>
              <div class="flex flex-col items-center">
                <button onclick="window.tipPostCreator('${p.id}')" class="text-xl bg-amber-500/20 border border-amber-400/50 w-9 h-9 rounded-full flex items-center justify-center" title="Tip 10 Coins">🪙</button>
                <span id="reel-tip-cnt-${p.id}" class="text-[10px] font-bold text-amber-300">${p.tips ? p.tips : 'Tip'}</span>
              </div>
              <button id="reel-save-btn-${p.id}" onclick="window.toggleBookmark('${p.id}')" class="text-xl">${isS ? '🔖' : '📑'}</button>
              <button onclick="window.openShareModal('${p.id}')" class="text-xl">✈️</button>
              <div onclick="window.playSynthTrack('${musicTitle}')" class="w-9 h-9 rounded-full border-2 border-white/60 bg-gradient-to-tr from-pink-500 to-indigo-600 flex items-center justify-center spin-disc cursor-pointer mt-1">🎵</div>
            </div>
          </div>`);
      });

      setupReelObserver();
    }

    let renderedFeedSignature = '';
    function renderFeed(forceRebuild = false) {
      document.getElementById('feed-filter-all').className = `flex-1 py-2 font-bold border-b-2 ${feedFilter==='all' ? 'theme-accent-text border-current' : 'border-transparent text-gray-500'}`;
      document.getElementById('feed-filter-following').className = `flex-1 py-2 font-bold border-b-2 ${feedFilter==='following' ? 'theme-accent-text border-current' : 'border-transparent text-gray-500'}`;
      const c = document.getElementById('feed-container');
      const myBlocked = DB.users[currentUser]?.blocked || {};
      let checkArr = Object.values(normMap(DB.posts)).filter(p => !myBlocked[p.author]).sort((a,b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.timestamp - a.timestamp);
      const myFCheck = DB.users[currentUser]?.following || {};
      if(feedFilter === 'following') checkArr = checkArr.filter(p => myFCheck[p.author] || p.author === currentUser);
      if(activeHashtag) checkArr = checkArr.filter(p => (p.caption || '').toLowerCase().includes(activeHashtag.toLowerCase()));
      const newFeedSig = `${feedFilter}|${activeHashtag}|` + checkArr.map(p => `${p.id}:${p.caption}:${p.pinned}:${carouselIdx[p.id]||0}:${JSON.stringify(p.pollVotes||{})}`).join('|');

      // If any video in feed is currently playing and post list/structure hasn't changed, update counts in-place!
      const isAnyFeedVideoPlaying = Array.from(c.querySelectorAll('video')).some(v => !v.paused);
      if(!forceRebuild && isAnyFeedVideoPlaying && renderedFeedSignature === newFeedSig) {
        const savedMap = DB.users[currentUser]?.saved || {};
        checkArr.forEach(p => {
          const likes = p.likes ? Object.keys(p.likes) : [], isL = likes.includes(currentUser), isS = !!savedMap[p.id], cCnt = p.comments ? Object.keys(p.comments).length : 0;
          const lBtn = document.getElementById(`feed-like-btn-${p.id}`);
          const lCnt = document.getElementById(`feed-like-cnt-${p.id}`);
          const cBtn = document.getElementById(`feed-cmt-btn-${p.id}`);
          const sBtn = document.getElementById(`feed-save-btn-${p.id}`);
          if(lBtn) lBtn.innerText = isL ? '❤️' : '🤍';
          if(lCnt) lCnt.innerText = `${likes.length} likes`;
          if(cBtn) cBtn.innerText = `💬 ${cCnt}`;
          if(sBtn) sBtn.innerText = isS ? '🔖' : '📑';
        });
        return;
      }
      renderedFeedSignature = newFeedSig;
      c.innerHTML = '';
      const myBlocked = DB.users[currentUser]?.blocked || {};
      let arr = Object.values(normMap(DB.posts)).filter(p => !myBlocked[p.author]).sort((a,b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.timestamp - a.timestamp);
      const myF = DB.users[currentUser]?.following || {};
      if(feedFilter === 'following') arr = arr.filter(p => myF[p.author] || p.author === currentUser);
      if(activeHashtag) arr = arr.filter(p => (p.caption || '').toLowerCase().includes(activeHashtag.toLowerCase()));
      if(arr.length === 0) { c.innerHTML = `<div class="text-center text-gray-500 text-xs py-12">No posts found. Tap ➕ to create one!</div>`; return; }
      const saved = DB.users[currentUser]?.saved || {};

      arr.forEach(p => {
        const likes = p.likes ? Object.keys(p.likes) : [], isL = likes.includes(currentUser), isS = !!saved[p.id], cCnt = p.comments ? Object.keys(p.comments).length : 0;
        const uMood = DB.users[p.author]?.mood || '';
        const musicTag = p.music ? `<div onclick="window.playSynthTrack('${p.music}')" class="px-3 pb-2 text-[11px] theme-accent-text flex items-center gap-1 font-semibold cursor-pointer hover:underline"><span>▶ ${p.music}</span></div>` : '';
        let mediaHTML = '';

        if(p.isPoll && p.pollOptions) {
          const votesMap = p.pollVotes || {}, totalVotes = Object.keys(votesMap).length, myVote = votesMap[currentUser];
          const optsHTML = p.pollOptions.map((opt, idx) => {
            const cnt = Object.values(votesMap).filter(v => v === idx).length, pct = totalVotes > 0 ? Math.round((cnt / totalVotes) * 100) : 0, picked = myVote === idx;
            return `<button onclick="window.votePoll('${p.id}', ${idx})" class="w-full text-left relative overflow-hidden rounded-xl border ${picked ? 'border-sky-400' : 'theme-border'} bg-black/50 p-3 text-xs font-semibold text-white"><div class="absolute inset-y-0 left-0 bg-sky-500/25" style="width:${pct}%"></div><div class="relative flex justify-between"><span>${opt} ${picked ? '✓' : ''}</span><span>${pct}% (${cnt})</span></div></button>`;
          }).join('');
          mediaHTML = `<div class="p-4 space-y-2 bg-white/5 border-y theme-border"><div class="font-bold text-sm mb-2">📊 ${formatRichText(p.caption)}</div>${optsHTML}<div class="text-[10px] text-gray-400 pt-1">${totalVotes} total votes</div></div>`;
        } else if(p.isQuote) {
          const bgGrad = p.quoteBg || 'from-pink-600 via-purple-600 to-indigo-700';
          mediaHTML = `<div id="post-img-${p.id}" ondblclick="window.doubleTapLike('${p.id}')" class="relative min-h-[240px] p-8 flex items-center justify-center text-center bg-gradient-to-br ${bgGrad} text-white font-heading font-bold text-lg leading-relaxed shadow-inner select-none"><div>“${formatRichText(p.caption)}”</div></div>`;
        } else if(p.video) {
          mediaHTML = `<div id="post-img-${p.id}" class="relative bg-black flex justify-center overflow-hidden" ondblclick="window.doubleTapLike('${p.id}')"><video src="${p.video}" controls loop playsinline preload="metadata" onplay="document.querySelectorAll('video').forEach(v=>{if(v!==this)v.pause()})" class="w-full object-cover max-h-[460px]"></video><span class="absolute top-2 left-2 bg-rose-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">🎬 REEL</span></div>`;
        } else {
          const imgs = (p.images && p.images.length) ? p.images : [p.image];
          const idx = carouselIdx[p.id] || 0, activeImg = imgs[idx] || p.image;
          const navBtns = imgs.length > 1 ? `<span class="absolute top-2 right-2 bg-black/75 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${idx+1}/${imgs.length}</span><button onclick="event.stopPropagation(); window.stepCarousel('${p.id}', -1)" class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/70 text-white w-7 h-7 rounded-full font-bold">‹</button><button onclick="event.stopPropagation(); window.stepCarousel('${p.id}', 1)" class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/70 text-white w-7 h-7 rounded-full font-bold">›</button>` : '';
          mediaHTML = `<div id="post-img-${p.id}" class="relative bg-black flex justify-center overflow-hidden" ondblclick="window.doubleTapLike('${p.id}')"><img src="${activeImg}" class="w-full object-cover max-h-[460px]">${navBtns}</div>`;
        }

        const reactionsMap = p.reactions || {};
        const reactionCounts = {};
        Object.values(reactionsMap).forEach(emoji => { reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1; });
        const reactionsHTML = Object.entries(reactionCounts).map(([em, cnt]) => `<span class="bg-white/10 px-2 py-0.5 rounded-full text-[10px] mr-1">${em} ${cnt}</span>`).join('');
        const safeCapForSpeech = (p.caption || '').replace(/['"]/g, '');

        c.insertAdjacentHTML('beforeend', `
          <div class="theme-card border-b theme-border pb-3 fade-in">
            ${p.pinned ? `<div class="px-3 pt-2 text-[10px] theme-accent-text font-bold">📌 Pinned Post</div>` : ''}
            <div class="flex items-center justify-between p-3">
              <div class="flex items-center gap-2 cursor-pointer" onclick="window.openUserProfile('${p.author}')">${generateAvatar(p.author, "w-8 h-8", true)}<div><span class="font-bold text-sm">${p.author}</span>${badgeHTML(p.author)}${uMood ? `<span class="text-[10px] text-gray-400 block leading-none">${uMood}</span>` : ''}</div></div>
              <div class="flex items-center gap-2">
                <button onclick="window.readPostCaption('${safeCapForSpeech}')" class="text-xs" title="Read Aloud">🔊</button>
                ${p.author !== currentUser ? `<button onclick="window.toggleFollow('${p.author}')" class="text-xs font-bold px-2 py-0.5 rounded border theme-border ${myF[p.author] ? 'text-gray-400' : 'theme-accent-text'}">${myF[p.author] ? 'Following' : '+ Follow'}</button>` : `<button onclick="window.togglePinPost('${p.id}')" class="text-xs" title="Pin">📌</button><button onclick="window.editPostCaption('${p.id}')" class="text-xs" title="Edit">✏️</button><button onclick="window.deletePost('${p.id}')" class="text-xs text-rose-500">Delete</button>`}
              </div>
            </div>
            ${musicTag}
            ${mediaHTML}
            <div class="p-3">
              <div class="flex justify-between mb-1.5 items-center">
                <div class="flex gap-4 items-center">
                  <button id="feed-like-btn-${p.id}" onclick="window.toggleLike('${p.id}')" class="text-lg">${isL ? '❤️' : '🤍'}</button>
                  <button id="feed-cmt-btn-${p.id}" onclick="window.openComments('${p.id}')" class="flex items-center gap-1 text-sm font-bold">💬 ${cCnt}</button>
                  <button onclick="window.openShareModal('${p.id}')" class="text-sm font-bold">✈️</button>
                  <button onclick="window.tipPostCreator('${p.id}')" class="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold" title="Tip 10 Coins">🪙 Tip ${p.tips ? `(${p.tips})` : ''}</button>
                </div>
                <div class="flex gap-1 text-xs">
                  <button onclick="window.togglePostReaction('${p.id}', '🔥')" title="Fire">🔥</button>
                  <button onclick="window.togglePostReaction('${p.id}', '👏')" title="Clap">👏</button>
                  <button onclick="window.togglePostReaction('${p.id}', '🚀')" title="Rocket">🚀</button>
                </div>
                <button id="feed-save-btn-${p.id}" onclick="window.toggleBookmark('${p.id}')" class="text-lg">${isS ? '🔖' : '📑'}</button>
              </div>
              <div class="flex flex-wrap gap-1 mb-1">${reactionsHTML}</div>
              <button id="feed-like-cnt-${p.id}" onclick="window.openLikesModal('${p.id}')" class="text-xs font-bold mb-1 block hover:underline">${likes.length} likes</button>
              ${(!p.isPoll && !p.isQuote) ? `<div class="text-sm"><b class="mr-1.5 cursor-pointer" onclick="window.openUserProfile('${p.author}')">${p.author}</b>${formatRichText(p.caption || '')}</div>` : ''}
              <div class="text-[10px] text-gray-500 mt-1">${formatTime(p.timestamp)}</div>
            </div>
          </div>`);
      });
    }

    function renderExplore() {
      const tBar = document.getElementById('trendingTagsBar');
      const tagsCount = {};
      Object.values(DB.posts || {}).forEach(p => {
        const matches = (p.caption || '').match(/#(\w+)/g);
        if(matches) matches.forEach(t => { tagsCount[t] = (tagsCount[t] || 0) + 1; });
      });
      const topTags = Object.keys(tagsCount).sort((a,b) => tagsCount[b] - tagsCount[a]).slice(0, 8);
      const defaultTags = ['#Viu', '#Coding', '#Design', '#Tech', '#Life'];
      const combinedTags = Array.from(new Set([...topTags, ...defaultTags]));
      tBar.innerHTML = combinedTags.map(tag => `<button onclick="window.setHashtagFilter('${tag}')" class="px-3 py-1 rounded-full border theme-border text-xs bg-black/40 whitespace-nowrap theme-accent-text font-semibold">${tag}</button>`).join('');

      document.getElementById('exp-tab-users').className = `flex-1 py-2 font-bold border-b-2 ${exploreSubTab==='users' ? 'theme-accent-text border-current' : 'border-transparent text-gray-500'}`;
      document.getElementById('exp-tab-grid').className = `flex-1 py-2 font-bold border-b-2 ${exploreSubTab==='grid' ? 'theme-accent-text border-current' : 'border-transparent text-gray-500'}`;

      const uCont = document.getElementById('explore-container');
      const gCont = document.getElementById('explore-grid-container');
      const q = document.getElementById('searchUsers').value.toLowerCase(), myF = DB.users[currentUser]?.following || {};

      uCont.classList.toggle('hidden', exploreSubTab !== 'users');
      gCont.classList.toggle('hidden', exploreSubTab !== 'grid');

      if(exploreSubTab === 'users') {
        uCont.innerHTML = '';
        Object.values(DB.users || {}).forEach(u => {
          if(!u?.username || u.username === currentUser) return;
          const match = u.username.toLowerCase().includes(q) || (u.mood && u.mood.toLowerCase().includes(q));
          if(q && !match) return;
          const uXp = getUserXP(u.username), uLv = getUserLevel(uXp);
          uCont.innerHTML += `<div class="theme-surface p-3 flex items-center justify-between rounded-xl border theme-border"><div class="flex items-center gap-3 cursor-pointer" onclick="window.openUserProfile('${u.username}')">${generateAvatar(u.username, "w-10 h-10", true)}<div><div class="font-bold text-sm">${u.username} ${badgeHTML(u.username)} <span class="text-[10px] text-sky-400">Lv.${uLv}</span></div><div class="text-[11px] text-gray-400">${u.mood || '✨ Using Viu'} • ${u.followers ? Object.keys(u.followers).length : 0} followers</div></div></div><div class="flex gap-1.5"><button onclick="window.toggleFollow('${u.username}')" class="px-3 py-1.5 rounded-lg text-xs font-bold ${myF[u.username] ? 'bg-white/10' : 'theme-accent-bg'}">${myF[u.username] ? 'Following' : 'Follow'}</button><button onclick="window.openChat('${u.username}')" class="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold">Chat</button></div></div>`;
        });
      } else {
        const photoPosts = Object.values(normMap(DB.posts)).filter(p => p.image && (!q || (p.caption||'').toLowerCase().includes(q) || p.author.toLowerCase().includes(q))).sort((a,b) => b.timestamp - a.timestamp);
        gCont.innerHTML = photoPosts.map(p => `<div onclick="window.openSinglePost('${p.id}')" class="aspect-square bg-gray-900 rounded overflow-hidden relative cursor-pointer group"><img src="${p.image}" class="w-full h-full object-cover"><div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition">❤️ ${p.likes ? Object.keys(p.likes).length : 0}</div></div>`).join('') || `<div class="col-span-3 text-center text-gray-500 text-xs py-8">No media posts found.</div>`;
      }
    }

    function renderProfile() {
      const u = DB.users[currentUser] || {}, postsMap = normMap(DB.posts);
      const myP = Object.values(postsMap).filter(p => p.author === currentUser && (p.image || p.video || p.isQuote)).sort((a,b) => b.timestamp - a.timestamp);
      const savP = Object.keys(u.saved || {}).map(id => postsMap[id]).filter(p => p && (p.image || p.video || p.isQuote));
      const bannerEl = document.getElementById('profile-banner');
      if(u.banner) bannerEl.style.backgroundImage = `url(${u.banner})`; else bannerEl.style.backgroundImage = '';

      document.getElementById('profile-username').innerText = currentUser;
      document.getElementById('profile-verified').classList.toggle('hidden', !u.verified);
      document.getElementById('profile-mood').innerText = u.mood || '✨ Using Viu';
      document.getElementById('profile-bio').innerText = u.bio || "Tap 'Edit Profile' to customize.";
      document.getElementById('profile-avatar-container').innerHTML = generateAvatar(currentUser, "w-full h-full text-2xl");
      document.getElementById('stat-posts').innerText = myP.length;
      document.getElementById('stat-followers').innerText = u.followers ? Object.keys(u.followers).length : 0;
      document.getElementById('stat-following').innerText = u.following ? Object.keys(u.following).length : 0;
      document.getElementById('stat-Saved').innerText = savP.length;
      document.getElementById('prof-tab-my').className = `flex-1 py-2 text-xs font-bold border-b-2 ${profileSubTab==='my' ? 'theme-accent-text border-current' : 'border-transparent text-gray-500'}`;
      document.getElementById('prof-tab-saved').className = `flex-1 py-2 text-xs font-bold border-b-2 ${profileSubTab==='saved' ? 'theme-accent-text border-current' : 'border-transparent text-gray-500'}`;
      const list = profileSubTab === 'my' ? myP : savP;
      document.getElementById('profile-grid').innerHTML = list.map(p => {
        if(p.isQuote) return `<div class="aspect-square bg-gradient-to-br ${p.quoteBg || 'from-pink-600 to-indigo-700'} rounded overflow-hidden p-2 flex items-center justify-center text-center text-[10px] font-bold text-white">${(p.caption||'').slice(0,45)}</div>`;
        if(p.video) return `<div onclick="window.openSinglePost('${p.id}')" class="aspect-square bg-gray-900 rounded overflow-hidden relative cursor-pointer"><video src="${p.video}" muted playsinline class="w-full h-full object-cover"></video><span class="absolute top-1 right-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded">🎬</span></div>`;
        return `<div onclick="window.openSinglePost('${p.id}')" class="aspect-square bg-gray-900 rounded overflow-hidden relative cursor-pointer"><img src="${p.image}" class="w-full h-full object-cover"></div>`;
      }).join('') || `<div class="col-span-3 text-center text-gray-500 text-xs py-8">No posts here yet.</div>`;
    }

    function renderChatList() {
      const nBox = document.getElementById('notes-container');
      const myNote = DB.notes?.[currentUser]?.text || 'Add Note...';
      nBox.innerHTML = `<div onclick="window.addThoughtNote()" class="flex flex-col items-center shrink-0 cursor-pointer w-16"><div class="bg-white/15 border theme-border text-[10px] px-2 py-1 rounded-xl mb-1 truncate max-w-full">${myNote}</div>${generateAvatar(currentUser, "w-11 h-11", true)}<span class="text-[10px] text-gray-400 mt-0.5">Your Note</span></div>`;
      Object.values(DB.notes || {}).forEach(n => {
        if(!n?.author || n.author === currentUser) return;
        nBox.innerHTML += `<div onclick="window.openChat('${n.author}')" class="flex flex-col items-center shrink-0 cursor-pointer w-16"><div class="theme-accent-bg text-[10px] font-bold px-2 py-1 rounded-xl mb-1 truncate max-w-full">${n.text}</div>${generateAvatar(n.author, "w-11 h-11", true)}<span class="text-[10px] truncate w-full text-center mt-0.5">${n.author}</span></div>`;
      });

      const c = document.getElementById('chatlist-container'), allM = Object.values(normMap(DB.messages)); c.innerHTML = '';
      const gTh = allM.filter(m => m.receiver === 'GLOBAL_GROUP').sort((a,b) => a.timestamp - b.timestamp);
      if(gTh.length) document.getElementById('global-chat-preview').innerText = `${gTh[gTh.length-1].sender}: ${gTh[gTh.length-1].text || 'Media'}`;

      Object.values(DB.users || {}).forEach(u => {
        if(!u?.username || u.username === currentUser) return;
        const th = allM.filter(m => (m.sender === currentUser && m.receiver === u.username) || (m.sender === u.username && m.receiver === currentUser)).sort((a,b) => a.timestamp - b.timestamp);
        const un = th.filter(m => m.sender === u.username && !m.read).length;
        const last = th.length ? (th[th.length-1].audio ? '🎙️ Voice Note' : (th[th.length-1].image ? '📷 Photo' : th[th.length-1].text)) : 'Tap to chat';
        c.innerHTML += `<div onclick="window.openChat('${u.username}')" class="theme-surface flex items-center p-3 rounded-xl border theme-border cursor-pointer gap-3">${generateAvatar(u.username, "w-11 h-11", true)}<div class="flex-1 overflow-hidden"><div class="font-bold text-sm">${u.username} ${badgeHTML(u.username)}</div><div class="text-xs text-gray-400 truncate">${last}</div></div>${un ? `<span class="theme-accent-bg text-[10px] font-bold px-2 py-0.5 rounded-full">${un}</span>` : ''}</div>`;
      });
    }

    function renderMessages() {
      const c = document.getElementById('chat-messages'), allM = Object.values(normMap(DB.messages)); c.innerHTML = '';
      const isGroup = currentChatTarget === 'GLOBAL_GROUP';
      const th = allM.filter(m => isGroup ? m.receiver === 'GLOBAL_GROUP' : ((m.sender === currentUser && m.receiver === currentChatTarget) || (m.sender === currentChatTarget && m.receiver === currentUser))).sort((a,b) => a.timestamp - b.timestamp);
      th.forEach(m => {
        const isMe = m.sender === currentUser;
        if(!isMe && !isGroup && !m.read) { setNested(DB, `messages/${m.id}/read`, true); saveLocalDB(); if(isFirebaseActive) set(ref(db, `messages/${m.id}/read`), true); }
        const safeTxt = (m.text || '').replace(/'/g, "");
        c.innerHTML += `
          <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} group w-full">
            ${isGroup && !isMe ? `<span class="text-[10px] text-sky-400 font-bold mb-0.5 ml-1">${m.sender}</span>` : ''}
            <div class="chat-bubble ${isMe ? 'chat-sent' : 'chat-recv'}">
              ${m.replyTo ? `<div class="text-[10px] bg-black/30 border-l-2 border-white/60 pl-2 py-0.5 mb-1 rounded opacity-85">${m.replyTo}</div>` : ''}
              ${m.image ? `<img src="${m.image}" class="rounded-lg max-h-48 mb-1">` : ''}
              ${m.audio ? `<audio controls src="${m.audio}" class="h-8 w-48 my-1"></audio>` : ''}
              ${m.text ? `<div>${formatRichText(m.text)}</div>` : ''}
              <div class="flex justify-end gap-1 items-center mt-1"><span class="text-[9px] opacity-70">${formatTime(m.timestamp)}</span>${isMe && !isGroup ? `<span class="${m.read ? 'tick-blue' : 'tick-gray'} text-[11px]">✓✓</span>` : ''}</div>
              ${m.reaction ? `<span class="absolute -bottom-2 ${isMe ? 'left-2' : 'right-2'} bg-black border border-white/20 rounded-full px-1.5 text-xs">${m.reaction}</span>` : ''}
            </div>
            <div class="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition text-xs items-center">
              <button onclick="window.reactMessage('${m.id}','❤️')">❤️</button><button onclick="window.reactMessage('${m.id}','🔥')">🔥</button><button onclick="window.reactMessage('${m.id}','😂')">😂</button>
              <button onclick="window.setReplyMsg('${m.sender}','${safeTxt}')" class="text-[10px] text-sky-400">↩️ Reply</button>
              ${isMe ? `<button onclick="window.editChatMessage('${m.id}','${safeTxt}')" class="text-[10px] text-amber-400">Edit</button><button onclick="window.deleteMessage('${m.id}')" class="text-[10px] text-rose-400">Unsend</button>` : ''}
            </div>
          </div>`;
      });
      c.scrollTop = c.scrollHeight;
      document.getElementById('typing-indicator').classList.toggle('hidden', isGroup || !(DB.typing?.[currentChatTarget]?.[currentUser]));
    }

    document.getElementById('chatInput').oninput = () => {
      if(!currentChatTarget || currentChatTarget === 'GLOBAL_GROUP' || currentChatTarget === 'ViuAI') return;
      apiSet(`typing/${currentUser}/${currentChatTarget}`, true);
      clearTimeout(typingTimeout); typingTimeout = setTimeout(() => apiSet(`typing/${currentUser}/${currentChatTarget}`, false), 1600);
    };
    document.getElementById('chatImageInput').onchange = (e) => {
      if(e.target.files[0] && currentChatTarget) compressImage(e.target.files[0], 500, (b64) => apiPush('messages', { sender: currentUser, receiver: currentChatTarget, text: '', image: b64, replyTo: replyToText, timestamp: Date.now(), read: false }));
      window.cancelReply();
    };
    document.getElementById('searchUsers').oninput = renderExplore;

    document.getElementById('loginForm').onsubmit = (e) => {
      e.preventDefault();
      const u = document.getElementById('usernameInput').value.trim(), p = document.getElementById('passwordInput').value.trim();
      if(DB.users[u]) { if(DB.users[u].password !== p) { document.getElementById('login-error').classList.remove('hidden'); return; } }
      else apiSet('users/' + u, { username: u, password: p, bio: 'Hey there! I am using Viu.', mood: '✨ Using Viu', lastSeen: Date.now() });
      currentUser = u; localStorage.setItem('viu_auth_user', u);
      apiSet(`users/${u}/lastSeen`, Date.now());
      document.getElementById('login-view').classList.add('hidden'); document.getElementById('app-container').classList.remove('hidden');
      
      if('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }

      window.showToast(`Welcome back, @${u}!`);
      updateUI();
    };

    document.getElementById('chatForm').onsubmit = (e) => {
      e.preventDefault();
      const inp = document.getElementById('chatInput'), txt = inp.value.trim();
      if(!txt || !currentChatTarget) return;
      const msgId = apiPush('messages', { sender: currentUser, receiver: currentChatTarget, text: txt, replyTo: replyToText, timestamp: Date.now(), read: currentChatTarget === 'ViuAI' });
      
      if(burnModeActive && currentChatTarget !== 'GLOBAL_GROUP' && currentChatTarget !== 'ViuAI') {
        setTimeout(() => { apiRemove(`messages/${msgId}`); }, 15000);
      }

      if('Notification' in window && Notification.permission === 'granted' && currentChatTarget !== 'GLOBAL_GROUP' && currentChatTarget !== 'ViuAI') {
        try { new Notification(`New message from @${currentUser}`, { body: txt }); } catch(err) {}
      }

      if(currentChatTarget === 'ViuAI') triggerViuAI(txt);
      else if(currentChatTarget !== 'GLOBAL_GROUP') apiSet(`typing/${currentUser}/${currentChatTarget}`, false);
      inp.value = ''; window.cancelReply();
    };

    document.getElementById('postImageInput').onchange = (e) => {
      const files = Array.from(e.target.files || []); if(!files.length) return;
      multiImagesList = [];
      files.forEach((f, idx) => {
        compressImage(f, 600, (b64) => {
          multiImagesList.push(b64);
          if(idx === 0) {
            rawUploadImageBase64 = b64; currentImageBase64 = b64;
            document.getElementById('imagePreview').src = b64; document.getElementById('imagePreview').classList.remove('hidden');
            document.getElementById('imagePlaceholder').classList.add('hidden'); document.getElementById('filterBar').classList.remove('hidden');
          }
          const badge = document.getElementById('multiCountBadge');
          if(multiImagesList.length > 1) { badge.innerText = `🖼️ ${multiImagesList.length} photos selected`; badge.classList.remove('hidden'); } else badge.classList.add('hidden');
        });
      });
    };

    document.getElementById('uploadForm').onsubmit = (e) => {
      e.preventDefault();
      const id = Date.now().toString(), cap = document.getElementById('postCaption').value.trim();
      const music = document.getElementById('storyMusicInput').value;

      if(uploadType === 'poll') {
        const o1 = document.getElementById('pollOpt1').value.trim(), o2 = document.getElementById('pollOpt2').value.trim(), o3 = document.getElementById('pollOpt3').value.trim();
        if(!cap || !o1 || !o2) { window.showToast("Enter question and 2 options!", "error"); return; }
        const opts = [o1, o2]; if(o3) opts.push(o3);
        apiSet('posts/' + id, { id, author: currentUser, isPoll: true, caption: cap, pollOptions: opts, timestamp: Date.now() });
        window.showToast("Poll Published! 📊");
      } else if(uploadType === 'quote') {
        if(!cap) { window.showToast("Write a quote first!", "error"); return; }
        const quoteBg = document.getElementById('quoteBgInput').value;
        apiSet('posts/' + id, { id, author: currentUser, isQuote: true, quoteBg, caption: cap, music, timestamp: Date.now() });
        window.showToast("Quote Card Published! 📝");
      } else if(uploadType === 'draw') {
        const drawImg = canvas.toDataURL('image/jpeg', 0.8);
        apiSet('posts/' + id, { id, author: currentUser, image: drawImg, images: [drawImg], caption: cap || 'Doodle Masterpiece 🎨', music, timestamp: Date.now() });
        window.showToast("Drawing Published! 🎨");
      } else if(uploadType === 'meme') {
        const memeCanvas = document.getElementById('memeCanvas');
        const memeImg = memeCanvas.toDataURL('image/jpeg', 0.82);
        apiSet('posts/' + id, { id, author: currentUser, image: memeImg, images: [memeImg], caption: cap || '😂 Cyber Meme #Meme #Viu', music, timestamp: Date.now() });
        window.showToast("Meme Published! 😂🔥");
      } else if(uploadType === 'reel') {
        const vUrl = document.getElementById('reelVideoUrlInput').value.trim();
        const videoSrc = vUrl || window.currentReelVideoBase64;
        if(!videoSrc && !currentImageBase64) {
          window.showToast("Kripya pehle Video/Photo chunein ya Preset/URL select karein!", "error");
          return;
        }
        const subBtn = document.getElementById('submitUploadBtn');
        if(subBtn) { subBtn.disabled = true; subBtn.innerText = "⏳ Publishing Reel..."; }
        window.showToast("Publishing your Reel... ⏳");
        setTimeout(() => {
          apiSet('posts/' + id, {
            id, author: currentUser, isReel: true,
            video: videoSrc || null,
            image: currentImageBase64 || null,
            caption: cap || '⚡ New Reel on Viu! #Reels #Viu',
            music: music || '🎵 Original Reel Audio',
            timestamp: Date.now()
          });
          window.clearReelSelection();
          if(subBtn) { subBtn.disabled = false; subBtn.innerText = "Publish"; }
          document.getElementById('postCaption').value = '';
          document.getElementById('uploadModal').classList.add('hidden');
          window.showToast("✅ Reel Published Successfully! 🎬");
          window.switchTab('reels');
        }, 250);
        return;
      } else {
        if(!currentImageBase64) { window.showToast("Select a photo first!", "error"); return; }
        const payload = { id, author: currentUser, image: currentImageBase64, images: multiImagesList.length ? multiImagesList : [currentImageBase64], caption: cap, music, timestamp: Date.now() };
        apiSet((uploadType === 'post' ? 'posts/' : 'stories/') + id, payload);
        window.showToast(uploadType === 'post' ? "Post Published! 📷" : "Story Added! ⚡");
      }
      document.getElementById('uploadModal').classList.add('hidden');
      document.getElementById('postCaption').value = ''; document.getElementById('pollOpt1').value = ''; document.getElementById('pollOpt2').value = ''; document.getElementById('pollOpt3').value = '';
      document.getElementById('imagePreview').classList.add('hidden'); document.getElementById('imagePlaceholder').classList.remove('hidden'); document.getElementById('filterBar').classList.add('hidden');
      document.getElementById('multiCountBadge').classList.add('hidden');
      currentImageBase64 = null; multiImagesList = []; activeArSticker = ''; window.switchTab('feed');
    };

// ==========================================
// NEW FEATURES IN v6.0 PRO MAX (PART 3)
// ==========================================

// 1. Cyber Coins & Creator Tipping System
window.openDailySpinModal = () => {
  if(!currentUser) return;
  const myCoins = DB.users[currentUser]?.coins ?? 100;
  document.getElementById('wallet-modal-coins').innerText = myCoins;
  document.getElementById('dailySpinModal').classList.remove('hidden');
};

window.claimDailySpin = () => {
  if(!currentUser) return;
  const lastSpin = DB.users[currentUser]?.lastSpin || 0;
  if(Date.now() - lastSpin < 3600000) {
    window.showToast("Wait 1 hour before next spin! ⏳", "error");
    return;
  }
  const rewardCoins = [25, 50, 75, 100, 150][Math.floor(Math.random() * 5)];
  const curCoins = DB.users[currentUser]?.coins ?? 100;
  apiSet(`users/${currentUser}/coins`, curCoins + rewardCoins);
  apiSet(`users/${currentUser}/lastSpin`, Date.now());
  apiSet(`users/${currentUser}/xpBonus`, (DB.users[currentUser]?.xpBonus || 0) + 30);
  window.showToast(`Jackpot! Won +${rewardCoins} Coins & +30 XP! 🎉`);
  window.openDailySpinModal();
};

window.tipPostCreator = (postId) => {
  const p = DB.posts[postId];
  if(!p || !currentUser) return;
  if(p.author === currentUser) {
    window.showToast("Aap khud ki post ko tip nahi kar sakte!", "error");
    return;
  }
  const myCoins = DB.users[currentUser]?.coins ?? 100;
  if(myCoins < 10) {
    window.showToast("Not enough Viu Coins! Play Arcade or Spin to earn.", "error");
    return;
  }
  const authorCoins = DB.users[p.author]?.coins ?? 100;
  apiSet(`users/${currentUser}/coins`, myCoins - 10);
  apiSet(`users/${p.author}/coins`, authorCoins + 10);
  apiSet(`posts/${postId}/tips`, (p.tips || 0) + 10);
  notify(p.author, `tipped you 10 Viu Coins 🪙 on your post!`);
  window.showToast(`Sent 10 Coins to @${p.author}! 🪙`);
};

// 2. Cyber Memory Match Mini-Game
const memEmojis = ['🚀', '⚡', '🤖', '💎', '🔥', '🎮', '👑', '🌌'];
let memDeck = [], memFlipped = [], memMatched = [], memMoves = 0;
window.memInitialized = false;

window.initMemoryGame = () => {
  window.memInitialized = true;
  memDeck = [...memEmojis, ...memEmojis].sort(() => Math.random() - 0.5);
  memFlipped = [];
  memMatched = [];
  memMoves = 0;
  window.renderMemoryBoard();
};

window.renderMemoryBoard = () => {
  const board = document.getElementById('memory-board');
  const movesEl = document.getElementById('mem-moves');
  if(!board) return;
  if(movesEl) movesEl.innerText = `Moves: ${memMoves}`;
  board.innerHTML = memDeck.map((em, idx) => {
    const isFlip = memFlipped.includes(idx) || memMatched.includes(idx);
    return `<div onclick="window.flipMemoryCard(${idx})" class="memory-card ${isFlip ? 'flipped' : ''}">${isFlip ? em : '❓'}</div>`;
  }).join('');
};

window.flipMemoryCard = (idx) => {
  if(memFlipped.length >= 2 || memFlipped.includes(idx) || memMatched.includes(idx)) return;
  memFlipped.push(idx);
  window.renderMemoryBoard();
  if(memFlipped.length === 2) {
    memMoves++;
    const [first, second] = memFlipped;
    if(memDeck[first] === memDeck[second]) {
      memMatched.push(first, second);
      memFlipped = [];
      window.renderMemoryBoard();
      if(memMatched.length === memDeck.length) {
        const curCoins = DB.users[currentUser]?.coins ?? 100;
        apiSet(`users/${currentUser}/coins`, curCoins + 50);
        apiSet(`users/${currentUser}/xpBonus`, (DB.users[currentUser]?.xpBonus || 0) + 80);
        window.showToast("Memory Cleared! +80 XP & +50 Coins! 🏆");
      }
    } else {
      setTimeout(() => {
        memFlipped = [];
        window.renderMemoryBoard();
      }, 650);
    }
  }
};


// ==========================================
// NEW FEATURES IN v7.0 ULTRA MAX
// ==========================================

window.reelsMuted = false;
window.currentReelVideoBase64 = null;

window.toggleReelsMute = () => {
  window.reelsMuted = !window.reelsMuted;
  const btn = document.getElementById('reelMuteBtn');
  if(btn) btn.innerText = window.reelsMuted ? '🔇 Muted' : '🔊 Sound';
  document.querySelectorAll('#reels-container video').forEach(v => v.muted = window.reelsMuted);
};

const reelInputEl = document.getElementById('reelVideoInput');
if(reelInputEl) {
  reelInputEl.onchange = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const statusEl = document.getElementById('reelFileStatus');
    const vidPrev = document.getElementById('reelVideoPreview');
    const imgPrev = document.getElementById('reelImagePreview');
    const placeEl = document.getElementById('reelVideoPlaceholder');

    if(file.type.startsWith('image/')) {
      compressImage(file, 650, (b64) => {
        currentImageBase64 = b64;
        window.currentReelVideoBase64 = null;
        if(vidPrev) vidPrev.classList.add('hidden');
        if(imgPrev) { imgPrev.src = b64; imgPrev.classList.remove('hidden'); }
        if(placeEl) placeEl.classList.add('hidden');
        if(statusEl) { statusEl.innerText = `✅ Reel Photo Ready (${file.name})`; statusEl.classList.remove('hidden'); }
        window.showToast("Photo Reel ke liye taiyaar hai! Ab Publish dabayein 📷");
      });
      return;
    }
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    if(file.size > 8.5 * 1024 * 1024) {
      window.showToast(`Video (${sizeMB}MB) bahut badi hai! Max 8MB chunein ya Preset/URL use karein.`, "error");
      return;
    }
    if(statusEl) { statusEl.innerText = `⏳ Loading video (${sizeMB} MB)...`; statusEl.classList.remove('hidden'); }
    const reader = new FileReader();
    reader.onload = (ev) => {
      window.currentReelVideoBase64 = ev.target.result;
      currentImageBase64 = null;
      if(imgPrev) imgPrev.classList.add('hidden');
      if(vidPrev) { vidPrev.src = window.currentReelVideoBase64; vidPrev.classList.remove('hidden'); }
      if(placeEl) placeEl.classList.add('hidden');
      if(statusEl) { statusEl.innerText = `✅ Video Ready (${sizeMB} MB) - Publish par click karein!`; statusEl.classList.remove('hidden'); }
      window.showToast("Reel Video Load Ho Gayi! Ab Publish par click karein 🎬");
    };
    reader.readAsDataURL(file);
  };
}

window.selectPresetReelVideo = (url, label) => {
  const urlInp = document.getElementById('reelVideoUrlInput');
  const vidPrev = document.getElementById('reelVideoPreview');
  const imgPrev = document.getElementById('reelImagePreview');
  const placeEl = document.getElementById('reelVideoPlaceholder');
  const statusEl = document.getElementById('reelFileStatus');
  if(urlInp) urlInp.value = url;
  window.currentReelVideoBase64 = url;
  currentImageBase64 = null;
  if(imgPrev) imgPrev.classList.add('hidden');
  if(vidPrev) { vidPrev.src = url; vidPrev.classList.remove('hidden'); }
  if(placeEl) placeEl.classList.add('hidden');
  if(statusEl) { statusEl.innerText = `✅ Selected Preset: ${label}`; statusEl.classList.remove('hidden'); }
  window.showToast(`${label} Video Selected! Ab Publish dabayein 🎬`);
};

window.onReelUrlInput = (val) => {
  const clean = val.trim();
  const statusEl = document.getElementById('reelFileStatus');
  const vidPrev = document.getElementById('reelVideoPreview');
  const placeEl = document.getElementById('reelVideoPlaceholder');
  if(clean.startsWith('http')) {
    window.currentReelVideoBase64 = clean;
    if(vidPrev) { vidPrev.src = clean; vidPrev.classList.remove('hidden'); }
    if(placeEl) placeEl.classList.add('hidden');
    if(statusEl) { statusEl.innerText = `✅ Video URL Ready!`; statusEl.classList.remove('hidden'); }
  }
};

window.clearReelSelection = () => {
  window.currentReelVideoBase64 = null;
  currentImageBase64 = null;
  const urlInp = document.getElementById('reelVideoUrlInput');
  const vidPrev = document.getElementById('reelVideoPreview');
  const imgPrev = document.getElementById('reelImagePreview');
  const placeEl = document.getElementById('reelVideoPlaceholder');
  const statusEl = document.getElementById('reelFileStatus');
  if(urlInp) urlInp.value = '';
  if(vidPrev) { vidPrev.pause(); vidPrev.src = ''; vidPrev.classList.add('hidden'); }
  if(imgPrev) { imgPrev.src = ''; imgPrev.classList.add('hidden'); }
  if(placeEl) placeEl.classList.remove('hidden');
  if(statusEl) statusEl.classList.add('hidden');
};

// Live 5s Camera Reel Recorder
let reelCamRecorder = null, reelCamChunks = [];
window.recordLiveCameraReel = async () => {
  const btn = document.getElementById('recordLiveReelBtn');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const vidPrev = document.getElementById('reelVideoPreview');
    const placeEl = document.getElementById('reelVideoPlaceholder');
    const statusEl = document.getElementById('reelFileStatus');
    if(placeEl) placeEl.classList.add('hidden');
    if(vidPrev) { vidPrev.srcObject = stream; vidPrev.muted = true; vidPrev.play(); vidPrev.classList.remove('hidden'); }
    if(btn) btn.innerText = "🔴 Recording 5s...";
    if(statusEl) { statusEl.innerText = "🔴 Recording Live Camera (5 seconds)..."; statusEl.classList.remove('hidden'); }

    reelCamChunks = [];
    reelCamRecorder = new MediaRecorder(stream);
    reelCamRecorder.ondataavailable = (e) => { if(e.data.size > 0) reelCamChunks.push(e.data); };
    reelCamRecorder.onstop = () => {
      const blob = new Blob(reelCamChunks, { type: 'video/webm' });
      const r = new FileReader();
      r.onloadend = () => {
        window.currentReelVideoBase64 = r.result;
        if(vidPrev) { vidPrev.srcObject = null; vidPrev.muted = false; vidPrev.src = r.result; }
        if(btn) btn.innerText = "📹 Record 5s Camera Reel";
        if(statusEl) statusEl.innerText = "✅ Live Camera Reel Recorded! Ab Publish dabayein!";
        window.showToast("Live Camera Reel Taiyaar Hai! 🎬");
      };
      r.readAsDataURL(blob);
      stream.getTracks().forEach(t => t.stop());
    };
    reelCamRecorder.start();
    setTimeout(() => {
      if(reelCamRecorder && reelCamRecorder.state === 'recording') reelCamRecorder.stop();
    }, 5000);
  } catch(err) {
    window.showToast("Camera permission nahi mili ya available nahi hai!", "error");
  }
};

// Reel Playback Speed Controller
const reelSpeeds = [1, 1.5, 2, 0.5];
let curSpeedIdx = 0;
window.cycleReelSpeed = () => {
  curSpeedIdx = (curSpeedIdx + 1) % reelSpeeds.length;
  const spd = reelSpeeds[curSpeedIdx];
  const btn = document.getElementById('reelSpeedBtn');
  if(btn) btn.innerText = `${spd}x`;
  document.querySelectorAll('#reels-container video').forEach(v => v.playbackRate = spd);
  window.showToast(`Reel Speed: ${spd}x ⚡`);
};

// Meme Generator Studio
let memeBgImg = new Image();
window.memeInitialized = false;
const memePresets = [
  ['#0f172a', '#00f3ff', '😎 WHEN CODE COMPILES', 'ON THE FIRST TRY'],
  ['#450a0a', '#f59e0b', '🔥 THIS IS FINE', 'PRODUCTION IS DOWN'],
  ['#1e1b4b', '#ec4899', '🧠 GALAXY BRAIN', 'USING VIU v8.0 INFINITY']
];

window.loadPresetMemeBg = (idx) => {
  window.memeInitialized = true;
  const p = memePresets[idx] || memePresets[0];
  const c = document.getElementById('memeCanvas');
  if(!c) return;
  const topInp = document.getElementById('memeTopText');
  const botInp = document.getElementById('memeBottomText');
  if(topInp && !topInp.value) topInp.value = p[2];
  if(botInp && !botInp.value) botInp.value = p[3];
  window.currentMemeGrad = [p[0], p[1]];
  window.currentMemePhoto = null;
  window.renderMemeCanvas();
};

const memeFileEl = document.getElementById('memeFileInput');
if(memeFileEl) {
  memeFileEl.onchange = (e) => {
    const f = e.target.files[0];
    if(!f) return;
    compressImage(f, 600, (b64) => {
      const img = new Image();
      img.onload = () => {
        window.currentMemePhoto = img;
        window.renderMemeCanvas();
      };
      img.src = b64;
    });
  };
}

window.renderMemeCanvas = () => {
  const c = document.getElementById('memeCanvas');
  if(!c) return;
  const ctxM = c.getContext('2d');
  if(window.currentMemePhoto) {
    ctxM.drawImage(window.currentMemePhoto, 0, 0, c.width, c.height);
  } else {
    const [c1, c2] = window.currentMemeGrad || ['#0f172a', '#00f3ff'];
    const grd = ctxM.createLinearGradient(0, 0, c.width, c.height);
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    ctxM.fillStyle = grd;
    ctxM.fillRect(0, 0, c.width, c.height);
  }
  const topT = (document.getElementById('memeTopText')?.value || 'TOP TEXT').toUpperCase();
  const botT = (document.getElementById('memeBottomText')?.value || 'BOTTOM TEXT').toUpperCase();
  ctxM.font = '900 22px Orbitron, Inter, sans-serif';
  ctxM.textAlign = 'center';
  ctxM.fillStyle = '#ffffff';
  ctxM.strokeStyle = '#000000';
  ctxM.lineWidth = 4;
  ctxM.strokeText(topT, c.width / 2, 42);
  ctxM.fillText(topT, c.width / 2, 42);
  ctxM.strokeText(botT, c.width / 2, c.height - 24);
  ctxM.fillText(botT, c.width / 2, c.height - 24);
};

// Cyber Snake 2077 Mini-Game
let snakeLoop = null, snakeBody = [{x: 6, y: 6}], snakeDir = {x: 1, y: 0}, snakeFood = {x: 10, y: 10}, snakePts = 0;
window.setSnakeDir = (dx, dy) => {
  if(snakeDir.x === -dx && snakeDir.y === -dy) return;
  snakeDir = {x: dx, y: dy};
};
window.addEventListener('keydown', (e) => {
  if(activeTab !== 'games') return;
  if(e.key === 'ArrowUp') window.setSnakeDir(0, -1);
  if(e.key === 'ArrowDown') window.setSnakeDir(0, 1);
  if(e.key === 'ArrowLeft') window.setSnakeDir(-1, 0);
  if(e.key === 'ArrowRight') window.setSnakeDir(1, 0);
});
window.startSnakeGame = () => {
  if(snakeLoop) clearInterval(snakeLoop);
  snakeBody = [{x: 6, y: 6}, {x: 5, y: 6}];
  snakeDir = {x: 1, y: 0};
  snakePts = 0;
  snakeFood = {x: Math.floor(Math.random()*14), y: Math.floor(Math.random()*14)};
  const scEl = document.getElementById('snake-score');
  if(scEl) scEl.innerText = `Score: 0`;
  snakeLoop = setInterval(stepSnake, 180);
};
function stepSnake() {
  const c = document.getElementById('snakeCanvas');
  if(!c) return;
  const ctxS = c.getContext('2d');
  const grid = 15, size = c.width / grid;
  const head = { x: (snakeBody[0].x + snakeDir.x + grid) % grid, y: (snakeBody[0].y + snakeDir.y + grid) % grid };

  if(snakeBody.some(seg => seg.x === head.x && seg.y === head.y)) {
    clearInterval(snakeLoop);
    snakeLoop = null;
    window.showToast(`Snake Game Over! Score: ${snakePts} 🐍`);
    return;
  }
  snakeBody.unshift(head);
  if(head.x === snakeFood.x && head.y === snakeFood.y) {
    snakePts += 10;
    const scEl = document.getElementById('snake-score');
    if(scEl) scEl.innerText = `Score: ${snakePts}`;
    snakeFood = {x: Math.floor(Math.random()*grid), y: Math.floor(Math.random()*grid)};
    if(currentUser) {
      const curCoins = DB.users[currentUser]?.coins ?? 100;
      apiSet(`users/${currentUser}/coins`, curCoins + 5);
      apiSet(`users/${currentUser}/xpBonus`, (DB.users[currentUser]?.xpBonus || 0) + 10);
    }
  } else {
    snakeBody.pop();
  }

  ctxS.fillStyle = '#050811';
  ctxS.fillRect(0, 0, c.width, c.height);
  ctxS.fillStyle = '#ff0055';
  ctxS.beginPath();
  ctxS.arc((snakeFood.x + 0.5)*size, (snakeFood.y + 0.5)*size, size/2.2, 0, Math.PI*2);
  ctxS.fill();

  snakeBody.forEach((seg, i) => {
    ctxS.fillStyle = i === 0 ? '#00f3ff' : '#10b981';
    ctxS.fillRect(seg.x*size + 1, seg.y*size + 1, size - 2, size - 2);
  });
}

// Cyber Shop System
window.openCyberShop = () => {
  if(!currentUser) return;
  const myCoins = DB.users[currentUser]?.coins ?? 100;
  const balEl = document.getElementById('shop-coin-balance');
  if(balEl) balEl.innerText = myCoins;
  document.getElementById('cyberShopModal').classList.remove('hidden');
};

window.buyShopItem = (itemKey, cost) => {
  if(!currentUser) return;
  const myCoins = DB.users[currentUser]?.coins ?? 100;
  if(myCoins < cost) {
    window.showToast(`Not enough coins! Need ${cost} 🪙`, "error");
    return;
  }
  apiSet(`users/${currentUser}/coins`, myCoins - cost);
  if(itemKey === 'vip_crown') {
    apiSet(`users/${currentUser}/vipTitle`, '👑 VIP');
    window.showToast("Unlocked 👑 VIP Crown Title!");
  } else if(itemKey === 'cyber_legend') {
    apiSet(`users/${currentUser}/vipTitle`, '⚡ LEGEND');
    window.showToast("Unlocked ⚡ LEGEND Title!");
  } else if(itemKey === 'xp_boost') {
    apiSet(`users/${currentUser}/xpBonus`, (DB.users[currentUser]?.xpBonus || 0) + 500);
    window.showToast("Boosted +500 XP! 🚀");
  } else if(itemKey === 'verified_tick') {
    apiSet(`users/${currentUser}/verified`, true);
    window.showToast("Unlocked Official Verified Tick! ☑️");
  }
  window.openCyberShop();
};

// Cyber Overclock Miner Mini-Game
let minerSessionCoins = 0, minerCombo = 1, lastMineTap = 0;
window.tapCyberCore = (e) => {
  if(!currentUser) return;
  const now = Date.now();
  if(now - lastMineTap < 450) minerCombo = Math.min(5, minerCombo + 1);
  else minerCombo = 1;
  lastMineTap = now;

  minerSessionCoins += minerCombo;
  const curCoins = DB.users[currentUser]?.coins ?? 100;
  apiSet(`users/${currentUser}/coins`, curCoins + minerCombo);
  apiSet(`users/${currentUser}/xpBonus`, (DB.users[currentUser]?.xpBonus || 0) + 2);

  const cEl = document.getElementById('miner-combo');
  const sEl = document.getElementById('miner-status');
  if(cEl) cEl.innerText = `Combo: x${minerCombo}`;
  if(sEl) sEl.innerText = `Mined this session: ${minerSessionCoins} 🪙`;
};

// Send Coin Gift in Chat
window.sendCoinGiftInChat = () => {
  if(!currentChatTarget || currentChatTarget === 'GLOBAL_GROUP' || currentChatTarget === 'ViuAI') {
    window.showToast("Open a direct user chat to send a gift!", "error");
    return;
  }
  const myCoins = DB.users[currentUser]?.coins ?? 100;
  if(myCoins < 20) {
    window.showToast("Need at least 20 Viu Coins to send a gift! 🪙", "error");
    return;
  }
  const targetCoins = DB.users[currentChatTarget]?.coins ?? 100;
  apiSet(`users/${currentUser}/coins`, myCoins - 20);
  apiSet(`users/${currentChatTarget}/coins`, targetCoins + 20);
  apiPush('messages', {
    sender: currentUser,
    receiver: currentChatTarget,
    text: `🎁 Sent a Cyber Gift Pack (+20 Viu Coins 🪙)!`,
    timestamp: Date.now(),
    read: false
  });
  notify(currentChatTarget, `sent you a 20 Viu Coins gift in chat! 🎁`);
  window.showToast(`Sent 20 Coins Gift to @${currentChatTarget}! 🎁`);
};
