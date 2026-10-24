const tg = window.Telegram.WebApp;
tg.expand();
const userId = tg.initDataUnsafe?.user?.id;

const fakeUsers = [
    "@CryptoKing_99", "@MariaCrypto", "@Elon_Fan", "@AirdropHunter", "@TonMaster", "@Faraon_Pro", "@GoldDigger", "@BTC_Lover", "@SandWalker", "@NileTrader", "@Scarab_777", "@PyramidX", "@Anubis_Rich", "@Cleopatra_VIP", "@Osiris_Earn", "@Crypto_Advisor", "@Satoshi_Fan", "@Ethereum_Whale", "@USDT_Master", "@Binance_Pro", "@Telegram_Earner", "@Lucky_User", "@Web3_Gamer", "@NFT_Collector", "@DeFi_King", "@CryptoNinja", "@MoonBoy", "@HODLer_2024", "@Altcoin_Hunter", "@Blockchain_Bro", "@Smart_Trader", "@Crypto_Guru", "@Earn_Daily", "@Passive_Income", "@Micro_Task_Pro", "@Cash_Hunter", "@Gold_Rush", "@Token_Whale", "@Satoshi_Nakamoto", "@Vitalik_Fan", "@Crypto_Wolf", "@Falcon_Trade", "@Bull_Market", "@Cobra_Coin", "@Lion_Heart", "@Eagle_Eye", "@Tiger_Trade", "@Shark_Invest", "@Dragon_Crypto", "@Phoenix_Rise", "@Alpha_Wolf", "@Beta_Tester", "@Gamma_Ray", "@Delta_Force", "@Omega_3"
];

function startFakeTicker() {
    const showNextWithdrawal = () => {
        const randomUser = fakeUsers[Math.floor(Math.random() * fakeUsers.length)];
        const randomAmount = (Math.random() * (15 - 5) + 5).toFixed(2);
        const ticker = document.getElementById('ticker-text');
        if (ticker) {
            ticker.innerHTML = `💸 Retiro exitoso para <span style="color:#fff;">${randomUser}</span> por <span style="color:#ffd700;">${randomAmount} USDT</span>`;
            ticker.style.animation = 'none';
            ticker.offsetHeight;
            ticker.style.animation = 'ticker 15s linear infinite';
        }
    };
    showNextWithdrawal();
    setInterval(showNextWithdrawal, 15000); 
}

function switchTab(tabName, btnElement = null) {
    document.querySelectorAll('.page-content').forEach(page => page.classList.remove('active'));
    document.getElementById(`page-${tabName}`).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    else {
        const navBtn = document.querySelector(`.nav-item[onclick*="'${tabName}'"]`);
        if (navBtn) navBtn.classList.add('active');
    }
}

function enterApp() {
    document.getElementById('intro-screen').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('intro-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        loadUserData();
        startFakeTicker();
    }, 1000);
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = (progress * (end - start) + start).toFixed(2);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function getReferralLink() {
    return `https://t.me/TU_BOT_AQUI?start=${userId}`; // ⚠️ CAMBIA ESTO POR TU BOT REAL
}

function loadUserData() {
    if (!userId) return;
    
    fetch(`/api/user/${userId}`).then(res => res.json()).then(data => {
        animateValue('balance', 0, data.balance, 1500);
        document.getElementById('withdraw-balance').innerText = data.balance.toFixed(2);
        document.getElementById('receive-amount').innerText = data.balance.toFixed(2) + ' USDT';
        document.getElementById('ref-link-text').innerText = getReferralLink();
    }).catch(err => console.log(err));

    fetch('/api/capital').then(res => res.json()).then(data => {
        if(data) {
            document.getElementById('capital-amount').innerText = Math.floor(data.capital_restante).toLocaleString('en-US');
        }
    }).catch(err => console.log(err));

    fetch(`/api/tasks/${userId}`).then(res => res.json()).then(data => {
        const container = document.getElementById('tasks-container');
        if (data.tasks && data.tasks.length > 0) {
            container.innerHTML = data.tasks.map(task => {
                const completed = data.completedIds.includes(task.id);
                const iconUrl = "https://raw.githubusercontent.com/hyuuknbctuuhfd/El_puto_egipto/main/public/papiro.png";
                
                let buttonHTML = '';
                if (completed) {
                    buttonHTML = `<button class="btn-3d" disabled style="opacity:0.5; background:#333; box-shadow:none;">✅ DONE</button>`;
                } else {
                    buttonHTML = `<button class="btn-3d" onclick="claimTask(${task.id})">CLAIM</button>`;
                }

                return `
                    <div class="card" style="display: flex; align-items: center; gap: 15px; padding: 15px;">
                        <img src="${iconUrl}" style="width: 40px; height: 40px; object-fit: contain;">
                        <div style="flex: 1;">
                            <h3 style="font-size: 14px; margin-bottom: 5px;">${task.title}</h3>
                            <p style="color: var(--gold); font-size: 12px; font-weight: bold;">+${task.reward} USDT</p>
                        </div>
                        ${buttonHTML}
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = `<p style="text-align:center; color:#889988; margin-top:20px;">No hay tareas disponibles ahora.</p>`;
        }
    }).catch(err => console.log(err));

    fetch('/api/ranking').then(res => res.json()).then(data => {
        document.getElementById('ranking-list').innerHTML = data.map((u, i) => {
            let medal = i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
            return `<div class="rank-item"><span class="name">${medal} ${u.username}</span><span class="points">${u.referidos} refs</span></div>`;
        }).join('');
    }).catch(err => console.log(err));
}

function claimTask(taskId) {
    if (!userId) return;
    fetch('/api/claim-task', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId })
    }).then(res => res.json()).then(data => {
        showToast(data.message || data.error, !data.success);
        if (data.success) loadUserData();
    });
}

let selectedNetwork = 'BEP20';
function selectNetwork(network, btnElement) {
    selectedNetwork = network;
    document.querySelectorAll('.network-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
}

function requestWithdraw() {
    if (!userId) return showToast("Abre esto desde Telegram", true);
    const wallet = document.getElementById('wallet-input').value;
    if (!wallet || wallet.length < 20) return showToast('Dirección de wallet inválida', true);
    const amount = parseFloat(document.getElementById('withdraw-balance').innerText);
    if (amount < 5) return showToast('El mínimo de retiro es 5 USDT', true);

    fetch('/api/withdraw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount, wallet, network: selectedNetwork })
    }).then(res => res.json()).then(data => {
        showToast(data.message || data.error, !data.success);
        if (data.success) {
            document.getElementById('wallet-input').value = '';
            loadUserData();
        }
    });
}

function showToast(message, isError = false) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.innerHTML = `<span>${isError ? '❌' : '✅'}</span> <span>${message}</span>`;
    if(isError) toast.style.borderColor = '#ff4444';
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function copyLink() {
    navigator.clipboard.writeText(getReferralLink()).then(() => {
        showToast('¡Enlace copiado!');
    });
}

function shareTelegram() {
    const text = encodeURIComponent("🔥 Bro, estoy ganando USDT como nunca con este bot. Solo hay que hacer microtareas y pagan al instante. Únete con mi enlace antes de que se acabe el capital del proyecto: ");
    const url = encodeURIComponent(getReferralLink());
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
}

loadUserData();
