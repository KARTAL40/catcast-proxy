const axios = require('axios');

module.exports = async (req, res) => {
    // URL'den ID'yi al (WHATWG API kullanarak güvenli hale getirdik)
    const { id } = req.query;
    const channelId = id || "50448";
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

    try {
        // 1. Catcast Embed sayfasından token çek
        const page = await axios.get(`https://catcast.tv/embed/${channelId}`, { 
            headers: { "User-Agent": userAgent } 
        });
        
        const html = page.data;
        const tokenMatch = html.match(/token[=:]["']?([a-f0-9]{32})["']?/i);
        
        if (!tokenMatch) {
            return res.status(403).send("Token bulunamadı. Yayın kapalı olabilir.");
        }
        
        const token = tokenMatch[1];

        // 2. Autopilot üzerinden m3u8 dosyasını iste
        const targetUrl = `https://autopilot.catcast.tv/mobile.m3u8?channel_id=${channelId}&token=${token}&server=v2.catcast.tv`;
        
        const response = await axios.get(targetUrl, {
            headers: { 
                "User-Agent": userAgent, 
                "Referer": "https://catcast.tv/" 
            }
        });

        let m3u8Content = response.data;
        
        // 3. Parça linklerini (TS) tam adrese çevir
        const baseUrl = `https://v2.catcast.tv/hls/`;
        const modifiedLines = m3u8Content.split('\n').map(line => {
            if (line.startsWith('#') || line.trim() === '') return line;
            return line.startsWith('http') ? line : baseUrl + line;
        });

        // 4. Yanıtı gönder
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        
        res.status(200).send(modifiedLines.join('\n'));
        
    } catch (error) {
        console.error("Hata Detayı:", error.message);
        res.status(500).send("Sunucu Hatası: " + error.message);
    }
};
