require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const bot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/admin', express.static('admin'));

app.get('/api/user/:id', (req, res) => {
    db.get(`SELECT * FROM users WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(row);
    });
});

app.get('/api/capital', (req, res) => {
    db.get(`SELECT * FROM project_config WHERE id = 1`, [], (err, row) => res.json(row));
});

setInterval(() => {
    db.get(`SELECT * FROM project_config WHERE id = 1`, [], (err, row) => {
        if (row && row.capital_restante > 0) {
            const decrease = (Math.random() * 50) + 150; 
            let newCapital = row.capital_restante - decrease;
            if (newCapital < 0) newCapital = 0;
            db.run(`UPDATE project_config SET capital_restante = ? WHERE id = 1`, [newCapital]);
        }
    });
}, 60000);

app.get('/api/tasks/:userId', (req, res) => {
    const userId = req.params.userId;
    db.all(`SELECT * FROM tasks WHERE active = 1`, [], (err, tasks) => {
        db.all(`SELECT task_id FROM completed_tasks WHERE user_id = ?`, [userId], (err, completed) => {
            const completedIds = completed.map(c => c.task_id);
            res.json({ tasks, completedIds });
        });
    });
});

app.post('/api/claim-task', (req, res) => {
    const { userId, taskId } = req.body;
    db.get(`SELECT * FROM tasks WHERE id = ? AND active = 1`, [taskId], (err, task) => {
        if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
        db.get(`SELECT * FROM completed_tasks WHERE user_id = ? AND task_id = ?`, [userId, taskId], (err, completed) => {
            if (completed) return res.status(400).json({ error: '⚠️ Ya reclamaste esta tarea' });
            
            db.run(`INSERT INTO completed_tasks (user_id, task_id) VALUES (?, ?)`, [userId, taskId]);
            db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [task.reward, userId]);
            
            db.get(`SELECT referidor_id FROM users WHERE id = ?`, [userId], (err, user) => {
                if (user && user.referidor_id) {
                    db.run(`UPDATE users SET referidos_activos = referidos_activos + 1 WHERE id = ?`, [user.referidor_id]);
                }
            });
            res.json({ success: true, message: `✅ ¡Recompensa reclamada! +${task.reward} USDT` });
        });
    });
});

app.post('/api/withdraw', (req, res) => {
    const { userId, amount, wallet, network } = req.body;
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
        if (user.balance < amount) return res.status(400).json({ error: 'Saldo insuficiente' });
        if (amount < 5) return res.status(400).json({ error: 'Mínimo 5 USDT' });
        if (user.referidos < 5) return res.status(400).json({ error: '❌ Necesitas 5 referidos para retirar. ¡Invita a más!' });
        
        db.run(`UPDATE users SET balance = balance - ?, wallet = ?, network = ? WHERE id = ?`, [amount, wallet, network, userId]);
        db.run(`INSERT INTO withdrawals (user_id, amount, wallet, network) VALUES (?, ?, ?, ?)`, [userId, amount, wallet, network]);
        res.json({ success: true, message: '✅ Retiro en proceso. Espere aprobación.' });
    });
});

app.post('/api/admin/login', (req, res) => {
    if (req.body.password === process.env.ADMIN_PASSWORD) res.json({ success: true });
    else res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.get('/api/admin/withdrawals', (req, res) => {
    db.all(`SELECT w.*, u.username FROM withdrawals w JOIN users u ON w.user_id = u.id WHERE w.status = 'pending'`, [], (err, rows) => res.json(rows));
});

app.post('/api/admin/withdrawals/:id/approve', (req, res) => {
    db.get(`SELECT * FROM withdrawals WHERE id = ?`, [req.params.id], (err, w) => {
        if (w) {
            db.run(`UPDATE withdrawals SET status = 'approved' WHERE id = ?`, [req.params.id]);
            db.get(`SELECT language FROM users WHERE id = ?`, [w.user_id], (err, user) => {
                const uLang = user ? user.language : 'es';
                const msg = lang[uLang].withdraw_approved.replace('%s', w.amount);
                bot.telegram.sendMessage(w.user_id, msg, { parse_mode: 'HTML' }).catch(e => console.log(e));
            });
        }
        res.json({ success: true });
    });
});

app.post('/api/admin/withdrawals/:id/reject', (req, res) => {
    db.get(`SELECT * FROM withdrawals WHERE id = ?`, [req.params.id], (err, w) => {
        if (w) {
            db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [w.amount, w.user_id]);
            db.run(`UPDATE withdrawals SET status = 'rejected' WHERE id = ?`, [req.params.id]);
            db.get(`SELECT language FROM users WHERE id = ?`, [w.user_id], (err, user) => {
                const uLang = user ? user.language : 'es';
                const msg = lang[uLang].withdraw_rejected.replace('%s', w.amount);
                bot.telegram.sendMessage(w.user_id, msg, { parse_mode: 'HTML' }).catch(e => console.log(e));
            });
        }
        res.json({ success: true });
    });
});

app.post('/api/admin/broadcast', (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'El mensaje está vacío' });
    db.all(`SELECT id FROM users WHERE banned = 0`, [], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).json({ error: 'No hay usuarios' });
        rows.forEach((user, index) => {
            setTimeout(() => {
                bot.telegram.sendMessage(user.id, message, { parse_mode: 'HTML' }).catch(e => console.log(e.message));
            }, index * 300);
        });
        res.json({ success: true, message: `Enviando a ${rows.length} usuarios...` });
    });
});

app.get('/api/admin/tasks', (req, res) => { db.all(`SELECT * FROM tasks`, [], (err, rows) => res.json(rows)); });
app.post('/api/admin/tasks', (req, res) => { db.run(`INSERT INTO tasks (title, link, reward, type) VALUES (?, ?, ?, ?)`, [req.body.title, req.body.link, req.body.reward, req.body.type]); res.json({ success: true }); });
app.delete('/api/admin/tasks/:id', (req, res) => { db.run(`DELETE FROM tasks WHERE id = ?`, [req.params.id]); res.json({ success: true }); });
app.get('/api/admin/users', (req, res) => { db.all(`SELECT * FROM users ORDER BY created_at DESC`, [], (err, rows) => res.json(rows)); });
app.post('/api/admin/ban/:id', (req, res) => { db.run(`UPDATE users SET banned = ? WHERE id = ?`, [req.body.banned, req.params.id]); res.json({ success: true }); });
app.post('/api/admin/add-balance', (req, res) => { db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [req.body.amount, req.body.userId]); res.json({ success: true }); });
app.post('/api/admin/add-refs', (req, res) => { db.run(`UPDATE users SET referidos = referidos + ? WHERE id = ?`, [req.body.amount, req.body.userId]); res.json({ success: true }); });

bot.launch();
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
