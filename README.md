# İkimizin Sineması • Watch Party

Kız arkadaşınla aynı anda YouTube videolarını senkronize izleyebileceğin, site içinden sesli konuşabileceğin ve sinema/tam ekran modunda video akışını bölmeden mesajlaşabileceğin özel web uygulaması.

## Özellikler

- **Senkronize YouTube Oynatıcı:** Biriniz başlattığında, durdurduğunda veya sardığında diğerinin ekranı da aynı saniyeye eşitlenir.
- **Otomatik Sinema & Tam Ekran Modu:** Video başladığında arayüz otomatik olarak sinema moduna geçer. Özel tam ekran butonu sayesinde tam ekrandayken bile sohbet ve sesli kontrol görünmeye devam eder.
- **Video Akışını Bölmeyen Yüzen Sohbet:** Sinema/tam ekran modundayken gelen mesajlar sol alt köşede küçük, yarı saydam balonlar olarak görünür ve birkaç saniye sonra kaybolur. `Enter` tuşuna basarak veya sağ alttaki 💬 simgesine tıklayarak videoyu durdurmadan cevap yazabilirsin.
- **Site İçi Sesli Sohbet (WebRTC):** Yankı ve gürültü engellemeli mikrofon, susturma (mute), karşı tarafın ses seviyesini ayarlama ve konuşuyor göstergesi.
- **Özel Oda & İsteğe Bağlı Şifre:** Odayı ilk kuran kişi şifre belirleyebilir; davet linkini tek tıkla kopyalayıp paylaşabilirsin.

## Kendi Bilgisayarında Çalıştırma

```bash
npm install
npm start
```

Ardından tarayıcıda `http://localhost:3000` adresini aç.

## Ücretsiz İnternete Yayınlama (Render)

Sesli sohbetin (mikrofon izninin) uzaktan sorunsuz çalışması için **HTTPS** gerekir; Render ve Railway ücretsiz olarak otomatik HTTPS verir.

1. Bu klasörü GitHub'a yükle (`node_modules` hariç, `.gitignore` hazır).
2. [Render.com](https://render.com) üzerinde ücretsiz hesap açıp **New + → Web Service** seç.
3. GitHub deponu bağla ve şu ayarları kullan:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - *(İsteğe bağlı)* Environment Variables kısmına `APP_PASSWORD` eklersen siteye girişte genel şifre sorar.
4. Oluşan `https://....onrender.com` linkini kız arkadaşınla paylaş!
