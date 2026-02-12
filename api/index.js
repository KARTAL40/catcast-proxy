const axios = require('axios');

module.exports = async (req, res) => {
    // ID yakalama (api/50448.m3u8 veya ?id=50448 formatları için)
    const { id } = req.query;
    const channelId = id ? id.replace('.m3u8', '') : "50448";
    
    // Tarayıcı gibi görünmek için detaylı User-Agent
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

    try {
        // 1. ADIM: View sayfasını dene (Embed yerine daha garantidir)
        const pageResponse = await axios.get(`https://www.catcast.tv/view/${channelId}`, { 
            headers: { 
                "User-Agent": userAgent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,webkit,*"
            },
            timeout: 10000 
        });
        
        const html = pageResponse.data;

        // 2. ADIM: Token Avcısı (Her iki ihtimali de kontrol eder)
        const tokenMatch = html.match(/token[:=]\s?["']?([a-f0-9]{32})["']?|['"]token['"]\s?:\s?['"]([a-f0-9]{32})['"]/i);
        const token = tokenMatch ? (tokenMatch[1] || tokenMatch[2]) : null;
        
        if (!token) {
            return res.status(403).send(`Hata: Token bulunamadi. Kanal (${channelId}) kapali veya IP engeli var. Bolge: ${process.env.VERCEL_REGION || 'Bilinmiyor'}`);
        }

        // 3. ADIM: m3u8 linkini al
        const targetUrl = `https://autopilot.catcast.tv/mobile.m3u8?channel_id=${channelId}&token=${token}&server=v2.catcast.tv`;
        
        const response = await axios.get(targetUrl, {
            headers: { 
                "User-Agent": userAgent, 
                "Referer": `https://www.catcast.tv/view/${channelId}` 
            }
        });

        let m3u8Content = response.data;
        
        // 4. ADIM: Linkleri IPTV uyumlu hale getir
        const baseUrl = `https://v2.catcast.tv/hls/`;
        const modifiedLines = m3u8Content.split('\n').map(line => {
            if (line.startsWith('#') || line.trim() === '') return line;
            return line.startsWith('http') ? line : baseUrl + line;
        });

        // Yanıt Gönderimi
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.status(200).send(modifiedLines.join('\n'));
        
    } catch (error) {
        const status = error.response ? error.response.status : 500;
        res.status(status).send(`Sunucu Hatasi: ${error.message} - Bolge: ${process.env.VERCEL_REGION || 'Bilinmiyor'}`);
    }
};
