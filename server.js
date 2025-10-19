const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const app = express();
const PORT = 3000;

// Tillåt requests från GitHub Pages
app.use(cors({
    origin: [
        'https://andersasplundberggren.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:5500'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('public'));

// Skapa agent för att undvika bot-detektion
const agent = ytdl.createAgent(undefined, {
    localAddress: undefined
});

app.post('/download', async (req, res) => {
    try {
        const { url, type, quality } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL krävs' });
        }

        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Ogiltig YouTube URL' });
        }

        console.log(`Laddar ner: ${url} (${type}, ${quality})`);

        const info = await ytdl.getInfo(url, { agent });
        const title = info.videoDetails.title.replace(/[^\w\s-]/g, '').substring(0, 100);

        let downloadOptions = {
            agent
        };

        if (type === 'audio') {
            downloadOptions.quality = 'highestaudio';
            downloadOptions.filter = 'audioonly';
            res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
            res.setHeader('Content-Type', 'audio/mpeg');
        } else {
            // För video med ljud
            downloadOptions.quality = 'highest';
            downloadOptions.filter = format => {
                return format.hasVideo && format.hasAudio;
            };
            res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
            res.setHeader('Content-Type', 'video/mp4');
        }

        const stream = ytdl(url, downloadOptions);
        
        stream.on('error', (error) => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: error.message || 'Nedladdning misslyckades' });
            }
        });

        stream.pipe(res);

    } catch (error) {
        console.error('Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || 'Ett fel uppstod' });
        }
    }
});

app.get('/info', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Ogiltig URL' });
        }

        const info = await ytdl.getInfo(url, { agent });
        
        res.json({
            title: info.videoDetails.title,
            thumbnail: info.videoDetails.thumbnails[0]?.url,
            duration: info.videoDetails.lengthSeconds,
            author: info.videoDetails.author.name
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server körs på http://localhost:${PORT}`);
    console.log(`📁 Öppna index.html i din webbläsare för att använda downloadern`);
});
