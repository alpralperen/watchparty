(() => {
  const socket = io();

  // DOM Elemanları
  const joinScreen = document.getElementById('join-screen');
  const roomScreen = document.getElementById('room-screen');
  const joinForm = document.getElementById('join-form');
  const inputName = document.getElementById('input-name');
  const inputRoom = document.getElementById('input-room');
  const inputPassword = document.getElementById('input-password');
  const joinError = document.getElementById('join-error');

  const displayRoomName = document.getElementById('display-room-name');
  const btnCopyInvite = document.getElementById('btn-copy-invite');
  const copyLabel = document.getElementById('copy-label');
  const usersBar = document.getElementById('users-bar');
  const hudUsers = document.getElementById('hud-users');

  const videoForm = document.getElementById('video-form');
  const inputVideoUrl = document.getElementById('input-video-url');
  const emptyVideoForm = document.getElementById('empty-video-form');
  const inputEmptyVideoUrl = document.getElementById('input-empty-video-url');
  const emptyPlayerState = document.getElementById('empty-player-state');

  const cinemaStage = document.getElementById('cinema-stage');
  const tapToPlayOverlay = document.getElementById('tap-to-play-overlay');
  const btnTapToPlay = document.getElementById('btn-tap-to-play');
  const btnScreenShare = document.getElementById('btn-screen-share');
  const screenBtnText = document.getElementById('screen-btn-text');
  const screenWrapper = document.getElementById('screen-wrapper');
  const screenVideo = document.getElementById('screen-video');
  const screenSharerBanner = document.getElementById('screen-sharer-banner');
  const btnStopShareBanner = document.getElementById('btn-stop-share-banner');
  const embedErrorState = document.getElementById('embed-error-state');
  const embedErrorDesc = document.getElementById('embed-error-desc');
  const btnOpenYouTube = document.getElementById('btn-open-youtube');
  const btnErrorScreenShare = document.getElementById('btn-error-screen-share');
  const btnEmptyScreenShare = document.getElementById('btn-empty-screen-share');

  const btnResync = document.getElementById('btn-resync');
  const btnCinemaToggle = document.getElementById('btn-cinema-toggle');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
  const chatSidebar = document.getElementById('chat-sidebar');
  const toggleAutoCinema = document.getElementById('toggle-auto-cinema');

  // HUD Elemanları
  const hudBtnScreenShare = document.getElementById('hud-btn-screen-share');
  const hudBtnVoice = document.getElementById('hud-btn-voice');
  const hudVoiceLabel = document.getElementById('hud-voice-label');
  const hudBtnMute = document.getElementById('hud-btn-mute');
  const hudBtnResync = document.getElementById('hud-btn-resync');
  const hudBtnChatFocus = document.getElementById('hud-btn-chat-focus');
  const hudBtnFullscreen = document.getElementById('hud-btn-fullscreen');
  const hudBtnExitCinema = document.getElementById('hud-btn-exit-cinema');
  const hudSyncToast = document.getElementById('hud-sync-toast');
  const cinemaHudToggle = document.getElementById('cinema-hud-toggle');

  // Sohbet Elemanları
  const chatMessages = document.getElementById('chat-messages');
  const sidebarChatForm = document.getElementById('sidebar-chat-form');
  const inputSidebarChat = document.getElementById('input-sidebar-chat');
  const typingIndicator = document.getElementById('typing-indicator');
  const floatingMessages = document.getElementById('floating-messages');
  const quickChatForm = document.getElementById('quick-chat-form');
  const inputQuickChat = document.getElementById('input-quick-chat');
  const btnCloseQuickChat = document.getElementById('btn-close-quick-chat');
  const cinemaChatTrigger = document.getElementById('cinema-chat-trigger');
  const cinemaUnreadBadge = document.getElementById('cinema-unread-badge');

  // Sesli Sohbet Elemanları
  const btnVoiceToggle = document.getElementById('btn-voice-toggle');
  const voiceBtnText = document.getElementById('voice-btn-text');
  const btnMuteToggle = document.getElementById('btn-mute-toggle');
  const iconMicOn = document.getElementById('icon-mic-on');
  const iconMicOff = document.getElementById('icon-mic-off');
  const voiceVolumeWrap = document.getElementById('voice-volume-wrap');
  const inputPartnerVolume = document.getElementById('input-partner-volume');
  const remoteAudioContainer = document.getElementById('remote-audio-container');

  // Uygulama Durumu
  let selfId = null;
  let currentRoomId = '';
  let currentUsers = [];
  let ytApiReady = false;
  let player = null;
  let playerReady = false;
  let currentVideoId = null;
  let pendingVideoState = null;

  // Senkronizasyon koruması
  let suppressSyncUntil = 0;
  let lastPolledTime = 0;
  let lastPolledAt = Date.now();
  let lastPolledPlaying = false;
  let hudHideTimer = null;
  let toastTimer = null;
  let typingTimer = null;
  let unreadCount = 0;

  // WebRTC Ses Durumu
  let voiceJoined = false;
  let isMuted = false;
  let localStream = null;
  let partnerVolume = 1;
  let audioContext = null;
  let micMonitorInterval = null;
  let lastSpeakingState = false;
  const peerConnections = new Map(); // peerId -> { pc, pendingCandidates, audioEl }

  // WebRTC Ekran / Sekme Paylaşımı Durumu
  let isSharingScreen = false;
  let screenStream = null;
  let activeSharerId = null;
  const screenPeers = new Map(); // peerId -> { pc, pendingCandidates }

  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // URL parametrelerini ve kayıtlı ismi doldur
  const params = new URLSearchParams(window.location.search);
  const urlRoom = params.get('room');
  inputName.value = localStorage.getItem('wp_name') || '';
  inputRoom.value = urlRoom || localStorage.getItem('wp_room') || 'ikimiz';

  // YouTube API hazır olduğunda çağrılır
  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    if (pendingVideoState && pendingVideoState.videoId) {
      applyVideoState(pendingVideoState, true);
    }
  };

  function extractYouTubeId(input) {
    const raw = String(input || '').trim();
    if (!raw) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

    try {
      const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      if (url.hostname.includes('youtu.be')) {
        const id = url.pathname.split('/').filter(Boolean)[0];
        return id && id.length === 11 ? id : null;
      }
      if (url.searchParams.has('v')) {
        const id = url.searchParams.get('v');
        return id && id.length === 11 ? id : null;
      }
      const parts = url.pathname.split('/').filter(Boolean);
      const markerIdx = parts.findIndex((p) => ['embed', 'shorts', 'live', 'v'].includes(p));
      if (markerIdx !== -1 && parts[markerIdx + 1]) {
        return parts[markerIdx + 1].slice(0, 11);
      }
    } catch {
      return null;
    }
    return null;
  }

  function formatTime(sec) {
    const total = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  function showHudToast(text) {
    if (!text) return;
    hudSyncToast.textContent = text;
    hudSyncToast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      hudSyncToast.classList.add('hidden');
    }, 2600);
  }

  function isSuppressed() {
    return Date.now() < suppressSyncUntil;
  }

  function suppressSync(ms = 1300) {
    suppressSyncUntil = Date.now() + ms;
  }

  function showEmbedError(code) {
    embedErrorState.classList.remove('hidden');
    if (currentVideoId) {
      btnOpenYouTube.href = `https://www.youtube.com/watch?v=${encodeURIComponent(currentVideoId)}`;
      btnOpenYouTube.classList.remove('hidden');
    } else {
      btnOpenYouTube.classList.add('hidden');
    }

    if (code === 100) {
      embedErrorDesc.textContent =
        'Bu video silinmiş veya gizli görünüyor. Başka bir link deneyebilir ya da kendi tarayıcından Sekme Paylaş ile açabilirsin.';
    } else {
      embedErrorDesc.textContent =
        'Video sahibi (kanal) bu videonun YouTube dışında oynatılmasını devre dışı bırakmış. Videoyu yeni sekmede YouTube\'da açıp "Sekme Paylaş" ile sesiyle birlikte sinema modunda izleyebilirsiniz!';
    }
  }

  const isTouchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  let autoplayCheckTimer = null;
  let isRotating = false;
  let rotateGuardTimer = null;

  function scheduleAutoplayCheck() {
    clearTimeout(autoplayCheckTimer);
    autoplayCheckTimer = setTimeout(() => {
      if (!player || !playerReady || !currentVideoId) return;
      const st = player.getPlayerState ? player.getPlayerState() : -1;
      // Mobilde uzak kullanıcı başlattığında tarayıcı otomatik oynatmayı engellerse tek dokunuş butonu göster
      if (st !== YT.PlayerState.PLAYING && st !== YT.PlayerState.BUFFERING) {
        tapToPlayOverlay.classList.remove('hidden');
      }
    }, 1100);
  }

  btnTapToPlay.addEventListener('click', () => {
    tapToPlayOverlay.classList.add('hidden');
    if (player && playerReady) {
      suppressSync(1400);
      player.playVideo();
      socket.emit('video:request-sync');
    }
    if (toggleAutoCinema.checked) {
      enterCinemaMode();
    }
  });

  function ensurePlayer(videoId, startSeconds = 0, shouldPlay = false) {
    emptyPlayerState.classList.add('hidden');
    embedErrorState.classList.add('hidden');
    tapToPlayOverlay.classList.add('hidden');
    currentVideoId = videoId;

    if (!ytApiReady) {
      pendingVideoState = { videoId, currentTime: startSeconds, isPlaying: shouldPlay };
      return;
    }

    if (!player) {
      player = new YT.Player('yt-player', {
        videoId,
        playerVars: {
          autoplay: shouldPlay ? 1 : 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          fs: isTouchDevice ? 1 : 0, // Mobilde iOS Safari dahil gerçek tam ekran için YouTube tam ekranı açık
          playsinline: 1,
          start: Math.floor(startSeconds)
        },
        events: {
          onReady: () => {
            playerReady = true;
            if (pendingVideoState) {
              const st = pendingVideoState;
              pendingVideoState = null;
              applyVideoState(st, true);
            } else if (shouldPlay) {
              scheduleAutoplayCheck();
            }
          },
          onStateChange: handlePlayerStateChange,
          onError: (event) => {
            if ([100, 101, 150, 153].includes(event.data)) {
              showEmbedError(event.data);
            }
          }
        }
      });
      return;
    }

    if (!playerReady) {
      pendingVideoState = { videoId, currentTime: startSeconds, isPlaying: shouldPlay };
      return;
    }

    suppressSync(1500);
    if (shouldPlay) {
      player.loadVideoById({ videoId, startSeconds });
      scheduleAutoplayCheck();
    } else {
      player.cueVideoById({ videoId, startSeconds });
    }
    lastPolledTime = startSeconds;
    lastPolledAt = Date.now();
    lastPolledPlaying = shouldPlay;
  }

  function applyVideoState(state, forceLoad = false) {
    if (!state || !state.videoId) return;

    if (!ytApiReady || !player || !playerReady || forceLoad || currentVideoId !== state.videoId) {
      ensurePlayer(state.videoId, state.currentTime || 0, Boolean(state.isPlaying));
      if (state.isPlaying && toggleAutoCinema.checked) {
        enterCinemaMode();
      }
      return;
    }

    suppressSync(1300);
    const localTime = player.getCurrentTime ? player.getCurrentTime() : 0;
    const targetTime = state.currentTime || 0;

    if (Math.abs(localTime - targetTime) > 1.4) {
      player.seekTo(targetTime, true);
    }

    if (state.isPlaying) {
      player.playVideo();
      scheduleAutoplayCheck();
      if (toggleAutoCinema.checked) {
        enterCinemaMode();
      }
    } else {
      clearTimeout(autoplayCheckTimer);
      tapToPlayOverlay.classList.add('hidden');
      player.pauseVideo();
    }

    lastPolledTime = targetTime;
    lastPolledAt = Date.now();
    lastPolledPlaying = Boolean(state.isPlaying);
  }

  function handlePlayerStateChange(event) {
    if (!playerReady) return;
    const state = event.data;

    if (state === YT.PlayerState.PLAYING) {
      clearTimeout(autoplayCheckTimer);
      tapToPlayOverlay.classList.add('hidden');
      if (toggleAutoCinema.checked) {
        enterCinemaMode();
      }
      lastPolledPlaying = true;
      lastPolledTime = player.getCurrentTime();
      lastPolledAt = Date.now();

      if (!isSuppressed() && !isRotating) {
        socket.emit('video:sync', {
          action: 'play',
          currentTime: player.getCurrentTime()
        });
      }
    } else if (state === YT.PlayerState.PAUSED) {
      if (isRotating) {
        // Telefon yan çevrilirken tarayıcı videoyu geçici duraklattıysa devam ettir, partnere pause gönderme
        return;
      }
      lastPolledPlaying = false;
      lastPolledTime = player.getCurrentTime();
      lastPolledAt = Date.now();

      if (!isSuppressed()) {
        socket.emit('video:sync', {
          action: 'pause',
          currentTime: player.getCurrentTime()
        });
      }
    }
  }

  // Zaman çizelgesi sarma (seek) tespiti
  setInterval(() => {
    if (!player || !playerReady || !currentVideoId) return;
    if (isSuppressed()) {
      lastPolledTime = player.getCurrentTime ? player.getCurrentTime() : lastPolledTime;
      lastPolledAt = Date.now();
      return;
    }

    const ytState = player.getPlayerState ? player.getPlayerState() : -1;
    if (ytState !== YT.PlayerState.PLAYING && ytState !== YT.PlayerState.PAUSED) return;

    const current = player.getCurrentTime();
    const now = Date.now();
    const elapsed = (now - lastPolledAt) / 1000;
    const expected = lastPolledPlaying ? lastPolledTime + elapsed : lastPolledTime;

    if (Math.abs(current - expected) > 1.8) {
      socket.emit('video:sync', {
        action: 'seek',
        currentTime: current
      });
    }

    lastPolledTime = current;
    lastPolledAt = now;
  }, 500);

  // ==========================================
  // SİNEMA MODU & TAM EKRAN & HUD YÖNETİMİ
  // ==========================================
  function isCinemaActive() {
    return document.body.classList.contains('cinema-mode') || getFullscreenElement() === cinemaStage;
  }

  function enterCinemaMode() {
    document.documentElement.classList.add('cinema-mode');
    document.body.classList.add('cinema-mode');
    revealHudTemporarily();
  }

  function exitCinemaMode() {
    document.documentElement.classList.remove('cinema-mode');
    document.body.classList.remove('cinema-mode');
    closeQuickChat();
    if (getFullscreenElement() === cinemaStage) {
      exitStageFullscreen();
    }
  }

  function getFullscreenElement() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      null
    );
  }

  function requestStageFullscreen() {
    if (cinemaStage.requestFullscreen) {
      return cinemaStage.requestFullscreen({ navigationUI: 'hide' }).catch(() =>
        cinemaStage.requestFullscreen()
      );
    }
    if (cinemaStage.webkitRequestFullscreen) {
      return Promise.resolve(cinemaStage.webkitRequestFullscreen());
    }
    return Promise.reject(new Error('Fullscreen desteklenmiyor'));
  }

  function exitStageFullscreen() {
    if (document.exitFullscreen) {
      return document.exitFullscreen().catch(() => {});
    }
    if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
    return Promise.resolve();
  }

  function toggleFullscreen() {
    if (getFullscreenElement() === cinemaStage) {
      exitStageFullscreen();
      return;
    }

    const canNativeFullscreen =
      (typeof cinemaStage.requestFullscreen === 'function' ||
        typeof cinemaStage.webkitRequestFullscreen === 'function') &&
      document.fullscreenEnabled !== false;

    if (!canNativeFullscreen) {
      if (document.body.classList.contains('cinema-mode')) {
        exitCinemaMode();
      } else {
        enterCinemaMode();
      }
      return;
    }

    enterCinemaMode();
    requestStageFullscreen()
      .then(() => {
        if (isTouchDevice && screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      })
      .catch(() => {});
  }

  let wasNativeFullscreen = false;
  function handleFullscreenChange() {
    const isFs = getFullscreenElement() === cinemaStage;
    if (isFs) {
      wasNativeFullscreen = true;
      revealHudTemporarily();
    } else if (wasNativeFullscreen) {
      wasNativeFullscreen = false;
      try {
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      } catch {}
      exitCinemaMode();
    }
  }

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

  // Telefon yan çevrildiğinde donmayı önle ve yatayda otomatik sinema modunu aç
  function handleMobileOrientationOrResize() {
    if (!isTouchDevice || !currentVideoId) return;

    const wasPlaying =
      lastPolledPlaying ||
      (player && playerReady && player.getPlayerState && player.getPlayerState() === YT.PlayerState.PLAYING);

    isRotating = true;
    suppressSync(1600);
    clearTimeout(rotateGuardTimer);

    const isLandscape = window.matchMedia('(orientation: landscape)').matches;
    if (isLandscape && Math.min(window.innerWidth, window.innerHeight) <= 600) {
      enterCinemaMode();
    }

    rotateGuardTimer = setTimeout(() => {
      if (wasPlaying && player && playerReady && player.getPlayerState) {
        const st = player.getPlayerState();
        if (st !== YT.PlayerState.PLAYING && st !== YT.PlayerState.BUFFERING) {
          suppressSync(1200);
          player.playVideo();
        }
      }
      isRotating = false;
    }, 450);
  }

  window.addEventListener('orientationchange', handleMobileOrientationOrResize);

  function revealHudTemporarily() {
    cinemaStage.classList.add('hud-visible');
    clearTimeout(hudHideTimer);
    if (!quickChatForm.classList.contains('hidden')) return;
    hudHideTimer = setTimeout(() => {
      cinemaStage.classList.remove('hud-visible');
    }, 2600);
  }

  cinemaHudToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (cinemaStage.classList.contains('hud-visible')) {
      clearTimeout(hudHideTimer);
      cinemaStage.classList.remove('hud-visible');
    } else {
      revealHudTemporarily();
    }
  });

  cinemaStage.addEventListener('mousemove', revealHudTemporarily);
  cinemaStage.addEventListener('touchstart', revealHudTemporarily, { passive: true });

  function openQuickChat() {
    quickChatForm.classList.remove('hidden');
    cinemaStage.classList.add('hud-visible');
    clearTimeout(hudHideTimer);
    unreadCount = 0;
    cinemaUnreadBadge.classList.add('hidden');
    inputQuickChat.focus();
  }

  function closeQuickChat() {
    quickChatForm.classList.add('hidden');
    inputQuickChat.blur();
    revealHudTemporarily();
  }

  btnCloseQuickChat.addEventListener('click', closeQuickChat);

  // Mobil tarayıcılarda ekran paylaşımı desteklenmiyorsa ilgili butonları gizle
  const canShareScreen = Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  if (!canShareScreen) {
    btnScreenShare.classList.add('no-screen-share');
    btnEmptyScreenShare.classList.add('no-screen-share');
    const altShareWrap = btnEmptyScreenShare.closest('.empty-alt-share');
    if (altShareWrap) altShareWrap.classList.add('no-screen-share');
  }

  // Mobil klavye açılınca sohbet listesini en alta kaydır
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // Klavye kısayolları: Sinema modunda Enter ile hızlı mesaj, Esc ile kapatma
  document.addEventListener('keydown', (e) => {
    if (joinScreen && !joinScreen.classList.contains('hidden')) return;

    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    const isTypingInField = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

    if (e.key === 'Escape') {
      if (!quickChatForm.classList.contains('hidden')) {
        closeQuickChat();
      } else if (document.body.classList.contains('cinema-mode') && !document.fullscreenElement) {
        exitCinemaMode();
      }
      return;
    }

    if (e.key === 'Enter' && !isTypingInField && isCinemaActive()) {
      e.preventDefault();
      openQuickChat();
    }
  });

  // ==========================================
  // SOHBET & YÜZEN MESAJ BALONLARI
  // ==========================================
  function appendSidebarMessage(msg) {
    if (msg.system) {
      const div = document.createElement('div');
      div.className = 'msg-system';
      div.textContent = msg.text;
      chatMessages.appendChild(div);
    } else {
      const isSelf = msg.senderId === selfId;
      const item = document.createElement('div');
      item.className = `msg-item ${isSelf ? 'self' : 'other'}`;

      const meta = document.createElement('div');
      meta.className = 'msg-meta';
      const timeStr = new Date(msg.timestamp || Date.now()).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      meta.textContent = `${isSelf ? 'Sen' : msg.senderName} • ${timeStr}`;

      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.textContent = msg.text;

      item.appendChild(meta);
      item.appendChild(bubble);
      chatMessages.appendChild(item);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function spawnFloatingToast(msg) {
    if (msg.system) return;
    const isSelf = msg.senderId === selfId;

    const toast = document.createElement('div');
    toast.className = `floating-toast ${isSelf ? 'self' : ''}`;

    const author = document.createElement('div');
    author.className = 'floating-toast-author';
    author.textContent = isSelf ? 'Sen' : msg.senderName;

    const body = document.createElement('div');
    body.textContent = msg.text;

    toast.appendChild(author);
    toast.appendChild(body);
    floatingMessages.appendChild(toast);

    while (floatingMessages.children.length > 4) {
      floatingMessages.removeChild(floatingMessages.firstChild);
    }

    setTimeout(() => {
      toast.classList.add('fading');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 460);
    }, 6500);
  }

  function sendChatText(text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    socket.emit('chat:send', { text: clean });
    socket.emit('chat:typing', { isTyping: false });
  }

  sidebarChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendChatText(inputSidebarChat.value);
    inputSidebarChat.value = '';
  });

  quickChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendChatText(inputQuickChat.value);
    inputQuickChat.value = '';
    closeQuickChat();
  });

  function emitTyping() {
    socket.emit('chat:typing', { isTyping: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socket.emit('chat:typing', { isTyping: false });
    }, 1500);
  }

  inputSidebarChat.addEventListener('input', emitTyping);
  inputQuickChat.addEventListener('input', emitTyping);

  // ==========================================
  // KULLANICI LİSTESİ & DURUM GÖSTERİMİ
  // ==========================================
  function renderUsers(users) {
    currentUsers = users || [];
    const renderInto = (container) => {
      container.innerHTML = '';
      currentUsers.forEach((u) => {
        const pill = document.createElement('span');
        pill.className = `user-pill ${u.speaking ? 'speaking' : ''}`;
        pill.dataset.userId = u.id;

        const dot = document.createElement('span');
        dot.className = 'status-dot';
        pill.appendChild(dot);

        const label = document.createElement('span');
        const micInfo = u.voiceJoined ? (u.muted ? ' 🔇' : ' 🎙️') : '';
        label.textContent = `${u.name}${u.id === selfId ? ' (Sen)' : ''}${micInfo}`;
        pill.appendChild(label);

        container.appendChild(pill);
      });
    };

    renderInto(usersBar);
    renderInto(hudUsers);
  }

  function updateUserSpeakingUI(userId, speaking) {
    document.querySelectorAll(`.user-pill[data-user-id="${userId}"]`).forEach((el) => {
      el.classList.toggle('speaking', Boolean(speaking));
    });
  }

  // ==========================================
  // WEBRTC SESLİ SOHBET
  // ==========================================
  function updateVoiceUI() {
    if (voiceJoined) {
      btnVoiceToggle.classList.add('active');
      voiceBtnText.textContent = 'Sesten Ayrıl';
      btnMuteToggle.classList.remove('hidden');
      voiceVolumeWrap.classList.remove('hidden');

      hudBtnVoice.classList.add('active');
      hudVoiceLabel.textContent = 'Ses Bağlı (Çık)';
      hudBtnMute.classList.remove('hidden');
    } else {
      btnVoiceToggle.classList.remove('active');
      voiceBtnText.textContent = 'Sesli Sohbet';
      btnMuteToggle.classList.add('hidden');
      voiceVolumeWrap.classList.add('hidden');

      hudBtnVoice.classList.remove('active');
      hudVoiceLabel.textContent = 'Sesli Sohbete Katıl';
      hudBtnMute.classList.add('hidden');
    }

    btnMuteToggle.classList.toggle('danger', isMuted);
    iconMicOn.classList.toggle('hidden', isMuted);
    iconMicOff.classList.toggle('hidden', !isMuted);

    hudBtnMute.classList.toggle('muted', isMuted);
    hudBtnMute.textContent = isMuted ? '🔇 Mikrofon Kapalı' : '🎙️ Mikrofon Açık';
  }

  function startMicMonitor(stream) {
    stopMicMonitor();
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      micMonitorInterval = setInterval(() => {
        if (!voiceJoined || isMuted) {
          if (lastSpeakingState) {
            lastSpeakingState = false;
            socket.emit('voice:speaking', { speaking: false });
            updateUserSpeakingUI(selfId, false);
          }
          return;
        }

        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const val = (data[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / data.length);
        const speakingNow = rms > 0.025;

        if (speakingNow !== lastSpeakingState) {
          lastSpeakingState = speakingNow;
          socket.emit('voice:speaking', { speaking: speakingNow });
          updateUserSpeakingUI(selfId, speakingNow);
        }
      }, 140);
    } catch {
      // Ses seviyesi göstergesi desteklenmiyorsa sessizce geç
    }
  }

  function stopMicMonitor() {
    if (micMonitorInterval) {
      clearInterval(micMonitorInterval);
      micMonitorInterval = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    lastSpeakingState = false;
  }

  function createPeerConnection(peerId) {
    if (peerConnections.has(peerId)) {
      return peerConnections.get(peerId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const entry = { pc, pendingCandidates: [], audioEl: null };
    peerConnections.set(peerId, entry);

    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice:signal', {
          targetId: peerId,
          type: 'ice-candidate',
          payload: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (!entry.audioEl) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        audio.volume = partnerVolume;
        remoteAudioContainer.appendChild(audio);
        entry.audioEl = audio;
      }
      entry.audioEl.srcObject = event.streams[0];
      entry.audioEl.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanupPeer(peerId);
      }
    };

    return entry;
  }

  function cleanupPeer(peerId) {
    const entry = peerConnections.get(peerId);
    if (!entry) return;
    try {
      entry.pc.close();
    } catch {}
    if (entry.audioEl && entry.audioEl.parentNode) {
      entry.audioEl.parentNode.removeChild(entry.audioEl);
    }
    peerConnections.delete(peerId);
  }

  async function joinVoice() {
    if (voiceJoined) return;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      voiceJoined = true;
      isMuted = false;
      updateVoiceUI();
      startMicMonitor(localStream);
      socket.emit('voice:join');
      showHudToast('Sesli sohbete katıldın');
    } catch (err) {
      alert(
        'Mikrofona erişilemedi. Lütfen tarayıcı izinlerini kontrol et (uzak sunucuda HTTPS gereklidir).'
      );
      console.error(err);
    }
  }

  function leaveVoice() {
    if (!voiceJoined) return;
    voiceJoined = false;
    isMuted = false;
    stopMicMonitor();

    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }

    Array.from(peerConnections.keys()).forEach(cleanupPeer);
    socket.emit('voice:leave');
    updateVoiceUI();
    showHudToast('Sesli sohbetten ayrıldın');
  }

  function toggleMute() {
    if (!voiceJoined || !localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
    socket.emit('voice:mute-state', { muted: isMuted });
    updateVoiceUI();
  }

  inputPartnerVolume.addEventListener('input', (e) => {
    partnerVolume = Number(e.target.value) / 100;
    peerConnections.forEach((entry) => {
      if (entry.audioEl) {
        entry.audioEl.volume = partnerVolume;
      }
    });
  });

  btnVoiceToggle.addEventListener('click', () => (voiceJoined ? leaveVoice() : joinVoice()));
  hudBtnVoice.addEventListener('click', () => (voiceJoined ? leaveVoice() : joinVoice()));
  btnMuteToggle.addEventListener('click', toggleMute);
  hudBtnMute.addEventListener('click', toggleMute);

  // ==========================================
  // WEBRTC SEKME / EKRAN PAYLAŞIMI
  // ==========================================
  function updateScreenShareUI() {
    if (isSharingScreen) {
      btnScreenShare.classList.add('active');
      screenBtnText.textContent = 'Paylaşımı Durdur';
      hudBtnScreenShare.classList.remove('hidden');
    } else {
      btnScreenShare.classList.remove('active');
      screenBtnText.textContent = 'Sekme Paylaş';
      hudBtnScreenShare.classList.add('hidden');
    }
  }

  function cleanupScreenPeer(peerId) {
    const entry = screenPeers.get(peerId);
    if (!entry) return;
    try {
      entry.pc.close();
    } catch {}
    screenPeers.delete(peerId);
  }

  function createScreenPeer(peerId, isSharerRole) {
    cleanupScreenPeer(peerId);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const entry = { pc, pendingCandidates: [] };
    screenPeers.set(peerId, entry);

    if (isSharerRole && screenStream) {
      screenStream.getTracks().forEach((track) => pc.addTrack(track, screenStream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('screen:signal', {
          targetId: peerId,
          type: 'ice-candidate',
          payload: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (isSharingScreen) return;
      screenVideo.srcObject = event.streams[0];
      screenVideo.muted = false;
      screenVideo.controls = true;
      screenSharerBanner.classList.add('hidden');
      screenWrapper.classList.remove('hidden');
      emptyPlayerState.classList.add('hidden');
      embedErrorState.classList.add('hidden');
      screenVideo.play().catch(() => {});
      if (toggleAutoCinema.checked) {
        enterCinemaMode();
      }
    };

    return entry;
  }

  async function startScreenShare() {
    if (isSharingScreen) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert('Bu tarayıcı sekme/ekran paylaşımını desteklemiyor. Masaüstünde Chrome veya Edge kullanabilirsin.');
      return;
    }

    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60, max: 60 }
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      isSharingScreen = true;
      activeSharerId = selfId;

      if (player && playerReady && player.pauseVideo) {
        suppressSync(1200);
        player.pauseVideo();
      }

      screenVideo.srcObject = screenStream;
      screenVideo.muted = true; // Paylaşan kişi çift ses duymasın
      screenVideo.controls = false;
      screenSharerBanner.classList.remove('hidden');
      screenWrapper.classList.remove('hidden');
      emptyPlayerState.classList.add('hidden');
      embedErrorState.classList.add('hidden');

      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      updateScreenShareUI();
      socket.emit('screen:start');
      showHudToast('Sekme / ekran paylaşımı başladı');
    } catch (err) {
      if (err && err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        alert('Ekran paylaşımı başlatılamadı.');
        console.error(err);
      }
    }
  }

  function stopScreenShare() {
    if (!isSharingScreen) return;
    isSharingScreen = false;
    activeSharerId = null;

    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      screenStream = null;
    }

    Array.from(screenPeers.keys()).forEach(cleanupScreenPeer);
    screenVideo.srcObject = null;
    screenWrapper.classList.add('hidden');
    screenSharerBanner.classList.add('hidden');
    if (!currentVideoId) {
      emptyPlayerState.classList.remove('hidden');
    }

    updateScreenShareUI();
    socket.emit('screen:stop');
    showHudToast('Ekran paylaşımı durduruldu');
  }

  function hideRemoteScreenView() {
    activeSharerId = null;
    Array.from(screenPeers.keys()).forEach(cleanupScreenPeer);
    screenVideo.srcObject = null;
    screenWrapper.classList.add('hidden');
    screenSharerBanner.classList.add('hidden');
    if (!currentVideoId) {
      emptyPlayerState.classList.remove('hidden');
    }
  }

  btnScreenShare.addEventListener('click', () => (isSharingScreen ? stopScreenShare() : startScreenShare()));
  btnErrorScreenShare.addEventListener('click', startScreenShare);
  btnEmptyScreenShare.addEventListener('click', startScreenShare);
  btnStopShareBanner.addEventListener('click', stopScreenShare);
  hudBtnScreenShare.addEventListener('click', stopScreenShare);

  // ==========================================
  // OLAY DİNLEYİCİLERİ (UI)
  // ==========================================
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    joinError.classList.add('hidden');

    const name = inputName.value.trim();
    const roomId = inputRoom.value.trim() || 'ikimiz';
    const password = inputPassword.value.trim();

    localStorage.setItem('wp_name', name);
    localStorage.setItem('wp_room', roomId);

    socket.emit('room:join', { name, roomId, password }, (res) => {
      if (!res || !res.ok) {
        joinError.textContent = (res && res.error) || 'Odaya bağlanılamadı.';
        joinError.classList.remove('hidden');
        return;
      }

      selfId = res.selfId;
      currentRoomId = res.roomId;
      displayRoomName.textContent = currentRoomId;

      const newUrl = `${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}`;
      window.history.replaceState({}, '', newUrl);

      joinScreen.classList.add('hidden');
      roomScreen.classList.remove('hidden');

      renderUsers(res.users);

      chatMessages.innerHTML = '';
      (res.messages || []).forEach(appendSidebarMessage);

      if (res.video && res.video.videoId) {
        applyVideoState(res.video, true);
      }
    });
  });

  function submitVideoUrl(rawUrl) {
    const videoId = extractYouTubeId(rawUrl);
    if (!videoId) {
      alert('Geçerli bir YouTube video linki veya 11 haneli video ID gir.');
      return;
    }
    socket.emit('video:change', { videoId });
  }

  videoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitVideoUrl(inputVideoUrl.value);
    inputVideoUrl.value = '';
  });

  emptyVideoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitVideoUrl(inputEmptyVideoUrl.value);
    inputEmptyVideoUrl.value = '';
  });

  btnCopyInvite.addEventListener('click', async () => {
    const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(currentRoomId)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      copyLabel.textContent = 'Kopyalandı!';
      setTimeout(() => {
        copyLabel.textContent = 'Davet Linki';
      }, 2000);
    } catch {
      prompt('Davet linkini kopyala:', inviteUrl);
    }
  });

  btnResync.addEventListener('click', () => {
    socket.emit('video:request-sync');
    showHudToast('Video eşitleniyor...');
  });
  hudBtnResync.addEventListener('click', () => {
    socket.emit('video:request-sync');
    showHudToast('Video eşitleniyor...');
  });

  btnCinemaToggle.addEventListener('click', () => {
    if (document.body.classList.contains('cinema-mode')) {
      exitCinemaMode();
    } else {
      enterCinemaMode();
    }
  });

  hudBtnExitCinema.addEventListener('click', exitCinemaMode);
  btnFullscreen.addEventListener('click', toggleFullscreen);
  hudBtnFullscreen.addEventListener('click', toggleFullscreen);

  btnSidebarToggle.addEventListener('click', () => {
    chatSidebar.classList.toggle('collapsed');
  });

  hudBtnChatFocus.addEventListener('click', openQuickChat);
  cinemaChatTrigger.addEventListener('click', openQuickChat);

  // ==========================================
  // SOCKET.IO OLAYLARI
  // ==========================================
  socket.on('room:users', (users) => {
    renderUsers(users);
  });

  socket.on('video:changed', (state) => {
    if (isSharingScreen) {
      stopScreenShare();
    } else if (activeSharerId) {
      hideRemoteScreenView();
    }
    applyVideoState(state, true);
    if (state.actorId !== selfId) {
      showHudToast(`${state.actorName} yeni video açtı`);
    }
  });

  socket.on('video:state', (state) => {
    applyVideoState(state, false);
    if (state.actorId !== selfId && state.actorId !== 'server') {
      const actionMap = {
        play: 'başlattı',
        pause: 'duraklattı',
        seek: `${formatTime(state.currentTime)} saniyesine sardı`
      };
      if (actionMap[state.action]) {
        showHudToast(`${state.actorName} ${actionMap[state.action]}`);
      }
    }
  });

  socket.on('chat:message', (msg) => {
    appendSidebarMessage(msg);

    const shouldFloat =
      isCinemaActive() || chatSidebar.classList.contains('collapsed');

    if (shouldFloat && !msg.system) {
      spawnFloatingToast(msg);
      if (msg.senderId !== selfId && quickChatForm.classList.contains('hidden')) {
        unreadCount += 1;
        cinemaUnreadBadge.textContent = unreadCount;
        cinemaUnreadBadge.classList.remove('hidden');
      }
    }
  });

  socket.on('chat:typing', ({ name, isTyping }) => {
    typingIndicator.textContent = isTyping ? `${name} yazıyor...` : '';
  });

  // WebRTC Signaling Events
  socket.on('voice:peer-joined', async ({ peerId }) => {
    if (!voiceJoined || peerId === selfId) return;
    const entry = createPeerConnection(peerId);
    try {
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      socket.emit('voice:signal', {
        targetId: peerId,
        type: 'offer',
        payload: offer
      });
    } catch (err) {
      console.error('WebRTC offer hatası:', err);
    }
  });

  socket.on('voice:peer-left', ({ peerId }) => {
    cleanupPeer(peerId);
  });

  socket.on('voice:speaking', ({ peerId, speaking }) => {
    updateUserSpeakingUI(peerId, speaking);
  });

  socket.on('voice:signal', async ({ fromId, type, payload }) => {
    if (!voiceJoined) return;
    const entry = createPeerConnection(fromId);
    const { pc } = entry;

    try {
      if (type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        while (entry.pendingCandidates.length) {
          await pc.addIceCandidate(new RTCIceCandidate(entry.pendingCandidates.shift()));
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice:signal', {
          targetId: fromId,
          type: 'answer',
          payload: answer
        });
      } else if (type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        while (entry.pendingCandidates.length) {
          await pc.addIceCandidate(new RTCIceCandidate(entry.pendingCandidates.shift()));
        }
      } else if (type === 'ice-candidate' && payload) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(payload));
        } else {
          entry.pendingCandidates.push(payload);
        }
      }
    } catch (err) {
      console.error('WebRTC sinyal hatası:', err);
    }
  });

  // WebRTC Screen Share Signaling Events
  socket.on('screen:started', ({ sharerId, sharerName }) => {
    if (sharerId === selfId) return;
    if (isSharingScreen) stopScreenShare();
    activeSharerId = sharerId;
    if (player && playerReady && player.pauseVideo) {
      suppressSync(1200);
      player.pauseVideo();
    }
    showHudToast(`${sharerName} ekranını paylaşıyor`);
  });

  socket.on('screen:stopped', ({ sharerId }) => {
    if (sharerId !== selfId) {
      hideRemoteScreenView();
      showHudToast('Ekran paylaşımı sona erdi');
    }
  });

  socket.on('screen:viewer-joined', async ({ viewerId }) => {
    if (!isSharingScreen || !screenStream || viewerId === selfId) return;
    const entry = createScreenPeer(viewerId, true);
    try {
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      socket.emit('screen:signal', {
        targetId: viewerId,
        type: 'offer',
        payload: offer
      });
    } catch (err) {
      console.error('Ekran paylaşımı offer hatası:', err);
    }
  });

  socket.on('screen:signal', async ({ fromId, type, payload }) => {
    try {
      if (type === 'offer') {
        const entry = createScreenPeer(fromId, false);
        await entry.pc.setRemoteDescription(new RTCSessionDescription(payload));
        while (entry.pendingCandidates.length) {
          await entry.pc.addIceCandidate(new RTCIceCandidate(entry.pendingCandidates.shift()));
        }
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        socket.emit('screen:signal', {
          targetId: fromId,
          type: 'answer',
          payload: answer
        });
      } else if (type === 'answer') {
        const entry = screenPeers.get(fromId);
        if (!entry) return;
        await entry.pc.setRemoteDescription(new RTCSessionDescription(payload));
        while (entry.pendingCandidates.length) {
          await entry.pc.addIceCandidate(new RTCIceCandidate(entry.pendingCandidates.shift()));
        }
      } else if (type === 'ice-candidate' && payload) {
        const entry = screenPeers.get(fromId);
        if (!entry) return;
        if (entry.pc.remoteDescription) {
          await entry.pc.addIceCandidate(new RTCIceCandidate(payload));
        } else {
          entry.pendingCandidates.push(payload);
        }
      }
    } catch (err) {
      console.error('Ekran paylaşımı sinyal hatası:', err);
    }
  });
})();
