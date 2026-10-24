const { Telegraf, Markup } = require('telegraf');
const db = require('./database');
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID;

const lang = {
    es: {
        welcome: `<b>🏺 ¡BIENVENIDO A AURUM! 🏺</b>\n\nLa cámara del faraón está abierta. Toma tu parte del botín.\n\n<b>💼 ¿Cómo funciona?</b>\n🔹 Únete a canales y bots aliados.\n🔹 Invita a amigos y gana comisiones.\n🔹 Retira en USDT.\n\n<b>💰 ¡El capital se agota!</b>\nToca el botón de abajo para entrar.`,
        btn_app: '🏛️ Entrar al Templo',
        new_ref: '🎉 <b>¡Nuevo Referido!</b>\n\nHas ganado <b>+0.60 USDT</b> por invitar a un amigo.',
        task_done: '✅ <b>¡Tarea completada!</b>\n\nHas ganado <b>%s USDT</b>. Vuelve a la app.',
        withdraw_approved: '✅ <b>¡Retiro Aprobado!</b>\n\nTu retiro de <b>%s USDT</b> ha sido procesado.',
        withdraw_rejected: '❌ <b>Retiro Rechazado</b>\n\nTu retiro de <b>%s USDT</b> fue rechazado. El saldo ha sido devuelto.'
    },
    en: {
        welcome: `<b>🏺 WELCOME TO AURUM! 🏺</b>\n\nThe Pharaoh's vault is open. Take your share of the loot.\n\n<b>💼 How it works?</b>\n🔹 Join partner channels and bots.\n🔹 Invite friends and earn commissions.\n🔹 Withdraw in USDT.\n\n<b>💰 The capital is running out!</b>\nTap the button below to enter.`,
        btn_app: '🏛️ Enter the Temple',
        new_ref: '🎉 <b>New Referral!</b>\n\nYou earned <b>+0.60 USDT</b> for inviting a friend.',
        task_done: '✅ <b>Task completed!</b>\n\nYou earned <b>%s USDT</b>. Return to the app.',
        withdraw_approved: '✅ <b>Withdrawal Approved!</b>\n\nYour withdrawal of <b>%s USDT</b> has been processed.',
        withdraw_rejected: '❌ <b>Withdrawal Rejected</b>\n\nYour withdrawal of <b>%s USDT</b> was rejected. Funds returned.'
    },
    ru: {
        welcome: `<b>🏺 ДОБРО ПОЖАЛОВАТЬ В AURUM! 🏺</b>\n\nХранилище фараона открыто. Заберите свою долю добычи.\n\n<b>💼 Как это работает?</b>\n🔹 Присоединяйтесь к каналам и ботам.\n🔹 Приглашайте друзей и получайте комиссию.\n🔹 Выводите в USDT.\n\n<b>💰 Капитал заканчивается!</b>\nНажмите кнопку ниже, чтобы войти.`,
        btn_app: '🏛️ Войти в Храм',
        new_ref: '🎉 <b>Новый Реферал!</b>\n\nВы заработали <b>+0.60 USDT</b> за приглашение друга.',
        task_done: '✅ <b>Задача выполнена!</b>\n\nВы заработали <b>%s USDT</b>. Вернитесь в приложение.',
        withdraw_approved: '✅ <b>Вывод Одобрен!</b>\n\nВаш вывод <b>%s USDT</b> обработан.',
        withdraw_rejected: '❌ <b>Вывод Отклонен!</b>\n\nВаш вывод <b>%s USDT</b> отклонен. Средства возвращены.'
    }
};

function getUserLang(userId, callback) {
    db.get(`SELECT language FROM users WHERE id = ?`, [userId], (err, row) => {
        const userLang = (row && row.language) ? row.language : 'es';
        callback(userLang);
    });
}

bot.start((ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Usuario';
    const referidorId = ctx.startPayload ? parseInt(ctx.startPayload) : null;

    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, row) => {
        if (row && row.banned === 1) return ctx.reply('🚫 Has sido expulsado del templo.');

        if (!row) {
            db.run(`INSERT INTO users (id, username, referidor_id) VALUES (?, ?, ?)`, [userId, username, referidorId]);
            if (referidorId) {
                db.run(`UPDATE users SET referidos = referidos + 1, balance = balance + 0.60 WHERE id = ?`, [referidorId]);
                getUserLang(referidorId, (refLang) => {
                    bot.telegram.sendMessage(referidorId, lang[refLang].new_ref, { parse_mode: 'HTML' }).catch(e => console.log(e));
                });
            }
        }

        ctx.replyWithHTML(lang['es'].welcome, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: lang['es'].btn_app, web_app: { url: process.env.MINI_APP_URL } }],
                    [{ text: '🌐 Idioma / Language / Язык', callback_data: 'change_lang' }]
                ]
            }
        });
    });
});

bot.action('change_lang', (ctx) => {
    ctx.reply('🌐 Elige tu idioma / Choose your language / Выберите язык:', 
        Markup.inlineKeyboard([
            [Markup.button.callback('🇪🇸 Español', 'set_es')],
            [Markup.button.callback('🇬🇧 English', 'set_en')],
            [Markup.button.callback('🇷🇺 Русский', 'set_ru')]
        ])
    );
});

bot.action(/set_(.+)/, (ctx) => {
    const selectedLang = ctx.match[1];
    db.run(`UPDATE users SET language = ? WHERE id = ?`, [selectedLang, ctx.from.id]);
    ctx.answerCbQuery('✅ OK');
    ctx.editMessageText(`✅ Idioma cambiado a ${selectedLang.toUpperCase()}. Vuelve a abrir la app.`);
});

bot.on('web_app_data', async (ctx) => {
    try {
        const data = JSON.parse(ctx.webAppData.data);
        if (data.action === 'verify_task') {
            const { taskId, userId } = data;
            db.get(`SELECT * FROM tasks WHERE id = ? AND active = 1`, [taskId], (err, task) => {
                if (!task) return ctx.reply('❌ Tarea no encontrada.');
                db.get(`SELECT * FROM completed_tasks WHERE user_id = ? AND task_id = ?`, [userId, taskId], (err, completed) => {
                    if (completed) return ctx.reply('⚠️ Ya completaste esta tarea.');
                    
                    db.run(`INSERT INTO completed_tasks (user_id, task_id) VALUES (?, ?)`, [userId, taskId]);
                    db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [task.reward, userId]);
                    
                    db.get(`SELECT referidor_id FROM users WHERE id = ?`, [userId], (err, user) => {
                        if (user && user.referidor_id) {
                            db.run(`UPDATE users SET referidos_activos = referidos_activos + 1 WHERE id = ?`, [user.referidor_id]);
                        }
                    });

                    getUserLang(userId, (uLang) => {
                        const msg = lang[uLang].task_done.replace('%s', task.reward);
                        ctx.replyWithHTML(msg);
                    });
                });
            });
        }
    } catch (e) { console.log("Error web app data", e); }
});

bot.command('broadcast', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return ctx.reply('🚫 No tienes permiso.');
    const message = ctx.message.text.replace('/broadcast ', '');
    if (!message || message === '/broadcast') return ctx.reply('Escribe el mensaje así: /broadcast Hola a todos');

    db.all(`SELECT id FROM users WHERE banned = 0`, [], (err, rows) => {
        if (err || rows.length === 0) return ctx.reply('No hay usuarios.');
        ctx.reply(`⏳ Enviando a ${rows.length} usuarios...`);
        rows.forEach((user, index) => {
            setTimeout(() => {
                bot.telegram.sendMessage(user.id, message, { parse_mode: 'HTML' }).catch(e => console.log(e.message));
            }, index * 300);
        });
    });
});

module.exports = bot;
