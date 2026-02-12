const axios = require('axios');

module.exports = async (req, res) => {
    // URL'den ID al, yoksa varsayılan 50448 kullan
    const { id } = req.query;
    const channelId = id || "50448";
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

    try {
        // 1. Adım: Embed sayfasını al
        const pageResponse = await axios.get(`https://catcast.tv/embed/${channelId}`, { 
            headers: { "User-Agent": userAgent },
            timeout: 5000 // 5 saniye içinde cevap gelmezse hata ver
        });
        
        const html = pageResponse.data;
        // Token'ı hem tırnaklı hem tırnaksız arayan daha güçlü regex
        const tokenMatch = html.match(/token[:=]\s?["']?([a-f0-9]{32})["']?/i);
        
        if (!tokenMatch) {
            return res.status(403).send("Hata: Sayfada Token bulunamadı. Yayın kapalı olabilir.");
        }
        
        const token = tokenMatch[1];

        // 2. Adım: m3u8 linkini iste
        const targetUrl = `https://autopilot.catcast.tv/mobile.m3u8?channel_id=${channelId}&token=${token}&server=v2.catcast.tv`;
        
        const response = await axios.get(targetUrl, {
            headers: { 
                "User-Agent": userAgent, 
                "Referer": "https://catcast.tv/" 
            }
        });

        let m3u8Content = response.data;
        
        // 3. Adım: Linkleri düzenle
        const baseUrl = `https://v2.catcast.tv/hls/`;
        const modifiedLines = m3u8Content.split('\n').map(line => {
            if (line.startsWith('#') || line.trim() === '') return line;
            return line.startsWith('http') ? line : baseUrl + line;
        });

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.status(200).send(modifiedLines.join('\n'));
        
    } catch (error) {
        // Hatanın nerede olduğunu anlamak için detaylı mesaj gönder
        const status = error.response ? error.response.status : 500;
        res.status(status).send(`Sunucu Hatası: ${error.message} (Bölge: ${process.env.VERCEL_REGION})`);
    }
};
