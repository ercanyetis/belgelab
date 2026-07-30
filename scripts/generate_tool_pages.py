#!/usr/bin/env python3
"""Generate BelgeLab tool landing pages from one shared v1.0 component."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_URL = "https://belgelab.com.tr/"
WEBSITE_ID = SITE_URL + "#website"

# filename: name, tool id, input, action, output, limitation, related pages
TOOLS = {
    "pdf-birlestir.html": ("PDF Birleştir", "pdf-editor", "birden fazla PDF", "sayfaları tek belgede birleştirme", "birleştirilmiş PDF", "Çıktı sırası, araçta belirlediğiniz sayfa sırasına göre oluşur.", ["pdf-sayfalari-duzenle.html", "pdf-kucult.html", "pdf-duzenle.html"]),
    "pdf-sayfalari-duzenle.html": ("PDF Sayfalarını Düzenle", "pdf-editor", "bir PDF belgesi", "sayfaları sıralama, döndürme veya kaldırma", "düzenlenmiş PDF", "Kaynak dosya değişmez; düzenlemeler indirilen yeni kopyaya uygulanır.", ["pdf-birlestir.html", "pdf-dondur.html", "pdf-kirp.html"]),
    "pdf-duzenle.html": ("PDF Düzenle", "pdf-editor", "bir PDF belgesi", "sayfa düzeni üzerinde değişiklik yapma", "düzenlenmiş PDF", "Araç, masaüstü yayıncılık uygulamalarındaki tüm metin düzenleme özelliklerini sunmaz.", ["pdf-sayfalari-duzenle.html", "pdf-birlestir.html", "pdf-filigran.html"]),
    "pdf-kucult.html": ("PDF Küçült", "pdf-compress", "boyutu azaltılacak PDF", "dosya boyutunu azaltma", "küçültülmüş PDF", "Küçültme sonucu belgenin içeriğine göre değişir; çıktının okunabilirliğini kontrol edin.", ["pdf-birlestir.html", "pdf-onar.html", "pdf-parola-ekle.html"]),
    "pdf-jpg.html": ("PDF'den JPG'ye", "pdf-to-jpg", "görsele dönüştürülecek PDF", "PDF sayfalarını JPG görsellerine dönüştürme", "JPG görselleri", "Çıktı çözünürlüğü ekrandaki önizleme ve kaynak PDF yapısından etkilenebilir.", ["jpg-pdf.html", "pdf-kirp.html", "pdf-dondur.html"]),
    "jpg-pdf.html": ("JPG'den PDF'ye", "jpg-to-pdf", "bir veya daha fazla JPG görseli", "görselleri PDF sayfalarına dönüştürme", "yeni PDF", "Görsellerin oranı ve çözünürlüğü PDF sayfalarının görünümünü etkiler.", ["pdf-jpg.html", "pdf-birlestir.html", "pdf-kucult.html"]),
    "pdf-imzala.html": ("PDF İmzala", "pdf-sign", "imza eklenecek PDF", "belirlenen metni imza olarak sayfaya yerleştirme", "imzalı PDF kopyası", "Bu araç metin tabanlı bir işaret ekler; nitelikli elektronik imza üretmez.", ["pdf-filigran.html", "pdf-parola-ekle.html", "pdf-duzenle.html"]),
    "pdf-filigran.html": ("PDF Filigran Ekle", "pdf-watermark", "filigran eklenecek PDF", "metin filigranını sayfalara uygulama", "filigranlı PDF", "Filigran görünümü seçilen metne, konuma ve kaynak sayfaların yapısına bağlıdır.", ["pdf-imzala.html", "pdf-sayfa-numarasi.html", "pdf-parola-ekle.html"]),
    "pdf-dondur.html": ("PDF Döndür", "pdf-rotate", "yönü değiştirilecek PDF", "sayfaları seçilen açıyla döndürme", "döndürülmüş PDF", "Döndürme sayfa içeriğini yeniden tasarlamaz; yalnızca sayfa yönünü değiştirir.", ["pdf-sayfalari-duzenle.html", "pdf-kirp.html", "pdf-birlestir.html"]),
    "pdf-sayfa-numarasi.html": ("PDF Sayfa Numarası Ekle", "pdf-page-numbers", "numaralandırılacak PDF", "sayfalara sıra numarası yerleştirme", "numaralı PDF", "Numara konumu, kaynak belgedeki mevcut altbilgi veya içerikle çakışabilir.", ["pdf-filigran.html", "pdf-birlestir.html", "pdf-duzenle.html"]),
    "pdf-kirp.html": ("PDF Kırp", "pdf-crop", "kırpılacak PDF", "sayfanın görünür alanını seçme", "kırpılmış PDF", "Kırpma alanının dışında kalan içerik çıktıda görünmez; indirmeden önce seçimi kontrol edin.", ["pdf-dondur.html", "pdf-sayfalari-duzenle.html", "pdf-jpg.html"]),
    "pdf-markdown.html": ("PDF'den Markdown'a", "pdf-to-markdown", "okunabilir metin içeren PDF", "metni Markdown dosyasına aktarma", "Markdown metni", "Karmaşık düzenler, tablolar ve taranmış sayfalar kaynakla aynı yapıda aktarılamayabilir.", ["pdf-word.html", "pdf-excel.html", "pdf-jpg.html"]),
    "pdf-parola-kaldir.html": ("PDF Parolasını Kaldır", "pdf-unlock", "parolasını bildiğiniz korumalı PDF", "geçerli parolayla erişim korumasını kaldırma", "parolasız PDF kopyası", "Araç bilinmeyen parolaları bulmaz veya kırmaz; doğru mevcut parola gerekir.", ["pdf-parola-ekle.html", "pdf-onar.html", "pdf-duzenle.html"]),
    "pdf-parola-ekle.html": ("PDF'ye Parola Ekle", "pdf-protect", "korunacak PDF", "belgeye erişim parolası uygulama", "parolalı PDF", "Parolanızı güvenli bir yerde saklayın; unutulan parolayı BelgeLab geri getiremez.", ["pdf-parola-kaldir.html", "pdf-filigran.html", "pdf-imzala.html"]),
    "pdf-onar.html": ("PDF Onar", "pdf-repair", "açılmasında sorun yaşanan PDF", "belge yapısını yeniden yazmayı deneme", "onarılmış PDF kopyası", "Ağır hasarlı veya eksik verili dosyaların onarılması garanti edilemez.", ["pdf-karsilastir.html", "pdf-kucult.html", "pdf-parola-kaldir.html"]),
    "pdf-karsilastir.html": ("PDF Karşılaştır", "pdf-compare", "karşılaştırılacak iki PDF", "belgelerin metin ve sayfa özelliklerini karşılaştırma", "karşılaştırma sonucu", "Görsel benzerlik veya hukuki belge doğrulaması yerine araçta sunulan teknik karşılaştırma esas alınır.", ["pdf-onar.html", "pdf-word.html", "pdf-sayfalari-duzenle.html"]),
    "pdf-word.html": ("PDF'den Word'e", "pdf-to-word", "okunabilir metin içeren PDF", "PDF metnini DOCX belgesine aktarma", "düzenlenebilir DOCX", "Sayfa tasarımı, tablolar ve görseller kaynak belgeyle aynı görünmeyebilir.", ["pdf-markdown.html", "pdf-excel.html", "word-pdf.html"]),
    "pdf-excel.html": ("PDF'den Excel'e", "pdf-to-excel", "okunabilir metin içeren PDF", "PDF metnini XLSX çalışma sayfasına aktarma", "XLSX çalışma kitabı", "Tablo yapısı ve hücre dağılımı kaynak belgenin düzenine göre değişebilir.", ["pdf-word.html", "excel-pdf.html", "excel-olustur.html"]),
    "pdf-powerpoint.html": ("PDF'den PowerPoint'e", "pdf-to-powerpoint", "sunuma aktarılacak PDF", "PDF sayfalarını sunum içeriğine dönüştürme", "PPTX sunumu", "Düzenlenebilirlik ve sayfa görünümü kaynak PDF'nin yapısına göre değişebilir.", ["powerpoint-pdf.html", "powerpoint-olustur.html", "pdf-jpg.html"]),
    "word-pdf.html": ("Word'den PDF'e", "word-to-pdf", "DOCX belgesi", "Word içeriğini PDF biçimine dönüştürme", "PDF belgesi", "Yazı tipleri, sayfa sonları ve karmaşık düzenler kaynak dosyadan farklı görünebilir.", ["pdf-word.html", "word-olustur.html", "pdf-birlestir.html"]),
    "excel-pdf.html": ("Excel'den PDF'e", "excel-to-pdf", "XLSX çalışma kitabı", "çalışma sayfasını PDF biçimine dönüştürme", "PDF belgesi", "Geniş tablolar, yazdırma alanları ve sayfa kırılımları çıktının görünümünü etkiler.", ["pdf-excel.html", "excel-olustur.html", "pdf-birlestir.html"]),
    "powerpoint-pdf.html": ("PowerPoint'ten PDF'e", "powerpoint-to-pdf", "PPTX sunumu", "sunum slaytlarını PDF biçimine dönüştürme", "PDF belgesi", "Animasyonlar, geçişler ve bazı yazı tipleri statik PDF çıktısına aynı şekilde yansımaz.", ["pdf-powerpoint.html", "powerpoint-olustur.html", "pdf-birlestir.html"]),
    "dwg-pdf.html": ("DWG'den PDF'e", "dwg-to-pdf", "DWG çizim dosyası", "teknik çizimi PDF biçimine dönüştürme", "PDF çizimi", "Sonuç, DWG sürümüne, çizimde kullanılan öğelere ve dönüştürme desteğine bağlıdır.", ["pdf-kucult.html", "pdf-kirp.html", "pdf-birlestir.html"]),
    "word-olustur.html": ("Word Oluştur", "create-word", "başlık ve paragraf içeriği", "metni DOCX belgesi olarak hazırlama", "DOCX belgesi", "Karmaşık masaüstü Word düzenlerinin tamamı bu sade oluşturucuda bulunmayabilir.", ["excel-olustur.html", "powerpoint-olustur.html", "word-pdf.html"]),
    "excel-olustur.html": ("Excel Oluştur", "create-excel", "satır ve sütun verileri", "verileri XLSX çalışma kitabına aktarma", "XLSX çalışma kitabı", "Gelişmiş formüller, makrolar ve masaüstü Excel özelliklerinin tamamı sunulmaz.", ["word-olustur.html", "powerpoint-olustur.html", "excel-pdf.html"]),
    "powerpoint-olustur.html": ("PowerPoint Oluştur", "create-powerpoint", "slayt başlıkları ve metinleri", "içeriği PPTX sunumu olarak hazırlama", "PPTX sunumu", "Gelişmiş animasyonlar ve ayrıntılı masaüstü tasarım araçları bu sade oluşturucuda bulunmaz.", ["word-olustur.html", "excel-olustur.html", "powerpoint-pdf.html"]),
}

BROWSER_TOOLS = {
    "pdf-birlestir.html", "pdf-sayfalari-duzenle.html", "pdf-duzenle.html",
    "pdf-kucult.html", "pdf-jpg.html", "jpg-pdf.html", "pdf-imzala.html",
    "pdf-filigran.html", "pdf-dondur.html", "pdf-sayfa-numarasi.html",
    "pdf-kirp.html", "pdf-markdown.html",
}


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def extract(pattern: str, source: str, fallback: str) -> str:
    match = re.search(pattern, source, re.I | re.S)
    return html.unescape(match.group(1).strip()) if match else fallback


def words(value: str) -> int:
    return len(re.findall(r"\b[\wÇĞİÖŞÜçğıöşü'-]+\b", value))


def build_about(name: str, source: str, action: str, output: str, caveat: str) -> str:
    text = (
        f"{name}, {source} ile çalışırken {action} sürecini tek ve anlaşılır bir akışta "
        f"tamamlamanıza yardımcı olan bir BelgeLab aracıdır. Ayrı bir masaüstü uygulaması "
        f"kurmadan modern tarayıcınızdan aracı açabilir, gerekli girdiyi hazırlayabilir ve "
        f"işlemi başlatabilirsiniz. Araç ekranı sayfanın başında yer aldığı için açıklamaları "
        f"okumadan da doğrudan çalışmaya geçebilirsiniz. İşlem sonunda oluşturulan {output} "
        f"cihazınıza indirilebilir; böylece kaynak dosyanızı ayrıca saklayabilir ve sonucu "
        f"kullanım amacınıza göre kontrol edebilirsiniz. {caveat} Özellikle önemli, resmî veya "
        f"arşivlenecek belgelerde çıktı dosyasını açıp sayfaları, metinleri ve beklenen düzeni "
        f"gözden geçirmeniz önerilir. BelgeLab sade Türkçe yönlendirmelerle gereksiz seçenekleri "
        f"azaltır ve temel belge işlemini bilgisayar, tablet ya da telefondan erişilebilir tutar. "
        f"Dosya biçimi veya tarayıcı desteği nedeniyle işlem tamamlanmazsa özgün dosyayı "
        f"değiştirmeden farklı bir kopyayla yeniden deneyebilirsiniz."
    )
    assert 120 <= words(text) <= 180, (name, words(text))
    return text


def security_text(filename: str, name: str) -> str:
    if filename in BROWSER_TOOLS:
        return (
            f"{name} işlemi, gerekli belge kütüphaneleri yüklendikten sonra tarayıcınızda "
            "gerçekleştirilir. Seçtiğiniz dosya bu işlem için BelgeLab sunucusuna yüklenmez. "
            "Site canlı ortamda HTTPS üzerinden sunulur. Yine de ortak cihazlarda indirdiğiniz "
            "çıktıları ve tarayıcının indirme geçmişini kullanımınız bittiğinde kontrol edin."
        )
    return (
        f"{name} işlemi için gerekli girdi BelgeLab sunucusuna HTTPS üzerinden gönderilir. "
        "Sunucu dosyayı yalnızca isteği işlemek ve indirilebilir sonucu oluşturmak amacıyla "
        "kullanır; uygulamada kalıcı kullanıcı hesabı veya belge arşivi bulunmaz. Hassas "
        "belgelerde işlemi yapmadan önce kurumunuzun veri paylaşımı kurallarını kontrol edin."
    )


def render(filename: str, cfg: tuple[str, ...], source_html: str) -> str:
    name, tool_id, source, action, output, caveat, related = cfg
    title = extract(r"<title>(.*?)</title>", source_html, f"{name} | BelgeLab")
    old_desc = extract(r'<meta\s+name="description"\s+content="([^"]*)"', source_html, "")
    description = (
        f"{name} aracıyla {action} işlemini kolayca tamamlayın; kullanım adımlarını, "
        f"güvenlik bilgisini, ipuçlarını ve sık sorulan soruları inceleyin."
    )
    if len(description) > 165:
        description = (
            f"{name} aracını kolayca kullanın. Adımları, güvenlik bilgisini, "
            f"ipuçlarını ve sık sorulan soruları inceleyin."
        )
    canonical = f"https://belgelab.com.tr/{filename}"
    h1 = extract(r"<h1>(.*?)</h1>", source_html, name)
    cta = f"{name} Aracını Aç"
    about = build_about(name, source, action, output, caveat)
    security = security_text(filename, name)
    related_cards = "".join(
        f'<a href="/{esc(item)}"><strong>{esc(TOOLS[item][0])}</strong>'
        f"<span>{esc(TOOLS[item][3].capitalize())} için ilgili aracı açın.</span></a>"
        for item in related
    )
    faqs = [
        (f"{name} nasıl kullanılır?", f"Aracı açın, {source} girdisini ekleyin, sunulan seçenekleri kontrol edin, işlemi başlatın ve hazırlanan {output} dosyasını indirin."),
        (f"{name} ücretsiz mi?", f"Evet. BelgeLab üzerindeki {name} aracını ücret ödemeden kullanabilirsiniz."),
        (f"{name} telefonda veya tablette çalışır mı?", "Araç modern mobil tarayıcılara uyumlu tasarlanmıştır. Büyük dosyalarda cihaz belleği ve bağlantı koşulları işlem süresini etkileyebilir."),
        (f"Kaynak dosyam değişir mi?", f"Hayır. İşlem yeni bir {output} oluşturur; cihazınızdaki kaynak dosyanın üzerine yazılmaz."),
        (f"İşlem sonucu neden beklediğimden farklı olabilir?", caveat),
        (f"{name} kullanırken nelere dikkat etmeliyim?", f"Doğru {source} girdisini seçtiğinizi doğrulayın, işlem tamamlanana kadar sayfayı kapatmayın ve indirdiğiniz çıktıyı kullanmadan önce kontrol edin."),
    ]
    faq_html = "".join(
        f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in faqs
    )
    faq_json = [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
        for q, a in faqs
    ]
    schema = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebPage", "@id": canonical + "#webpage", "url": canonical,
             "name": title.replace(" | BelgeLab", ""), "description": description,
             "inLanguage": "tr", "isPartOf": {"@id": WEBSITE_ID},
             "breadcrumb": {"@id": canonical + "#breadcrumb"}},
            {"@type": "BreadcrumbList", "@id": canonical + "#breadcrumb",
             "itemListElement": [
                 {"@type": "ListItem", "position": 1, "name": "Ana Sayfa",
                  "item": SITE_URL},
                 {"@type": "ListItem", "position": 2, "name": name,
                  "item": canonical},
             ]},
            {"@type": "FAQPage", "@id": canonical + "#faq",
             "isPartOf": {"@id": canonical + "#webpage"}, "mainEntity": faq_json},
        ],
    }
    return f"""<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#07111f">
  <meta name="description" content="{esc(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="{canonical}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="tr_TR">
  <meta property="og:site_name" content="BelgeLab">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:image" content="https://belgelab.com.tr/icon-512.png">
  <meta property="og:image:alt" content="BelgeLab {esc(name)} aracı">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(title)}">
  <meta name="twitter:description" content="{esc(description)}">
  <meta name="twitter:image" content="https://belgelab.com.tr/icon-512.png">
  <title>{esc(title)}</title>
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <link rel="stylesheet" href="/style.css">
  <script type="application/ld+json">{json.dumps(schema, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")}</script>
</head>
<body>
  <header class="site-header legal-header"><a class="brand" href="/">Belge<span>Lab</span></a><a href="/#tools">Araçlara dön</a></header>
  <main class="landing-page">
    <section class="landing-hero" aria-labelledby="tool-title">
      <div><p class="eyebrow">BELGELAB BELGE ARACI</p><h1 id="tool-title">{esc(h1)}</h1><p>{esc(description)} {esc(caveat)}</p><a class="landing-cta" href="/?tool={esc(tool_id)}">{esc(cta)}</a></div>
      <div class="landing-visual" aria-hidden="true"><span class="landing-file">GİRDİ</span><span class="landing-arrow">→</span><span class="landing-file landing-file-result">ÇIKTI</span></div>
    </section>
    <section class="landing-section" aria-labelledby="arac-hakkinda"><p class="eyebrow">ARAÇ HAKKINDA</p><h2 id="arac-hakkinda">{esc(name)} ne yapar?</h2><p>{esc(about)}</p></section>
    <section class="landing-section landing-steps" aria-labelledby="nasil-kullanilir"><p class="eyebrow">ADIM ADIM</p><h2 id="nasil-kullanilir">{esc(name)} nasıl kullanılır?</h2><ol>
      <li><span>1</span><div><h3>Aracı açın</h3><p>Sayfanın üstündeki düğmeyle {esc(name)} çalışma ekranına geçin.</p></div></li>
      <li><span>2</span><div><h3>Girdiyi hazırlayın</h3><p>{esc(source.capitalize())} dosyasını veya içeriğini cihazınızda kontrol edin.</p></div></li>
      <li><span>3</span><div><h3>Girdiyi ekleyin</h3><p>İstenen dosyayı seçin ve araçta sunulan alanların yüklenmesini bekleyin.</p></div></li>
      <li><span>4</span><div><h3>Seçenekleri kontrol edin</h3><p>{esc(action.capitalize())} için görünen seçenekleri ihtiyacınıza göre belirleyin.</p></div></li>
      <li><span>5</span><div><h3>İşlemi tamamlayın</h3><p>İşlemi başlatın, hazırlanan {esc(output)} dosyasını indirin ve sonucu açarak kontrol edin.</p></div></li>
    </ol></section>
    <section class="landing-section" aria-labelledby="neden-belgelab"><p class="eyebrow">NEDEN BELGELAB?</p><h2 id="neden-belgelab">Belge işlemleri için sade bir çalışma alanı</h2><div class="benefit-grid">
      <article><span>01</span><h3>Hızlı erişim</h3><p>Araç ekranına sayfanın üstündeki belirgin bağlantıdan doğrudan ulaşın.</p></article>
      <article><span>02</span><h3>Kurulum gerektirmez</h3><p>Ek bir masaüstü uygulaması kurmadan modern tarayıcınız üzerinden çalışın.</p></article>
      <article><span>03</span><h3>Türkçe yönlendirme</h3><p>Adımları ve olası çıktı farklarını anlaşılır Türkçe açıklamalarla takip edin.</p></article>
    </div></section>
    <section class="landing-section" aria-labelledby="avantajlar"><p class="eyebrow">AVANTAJLAR</p><h2 id="avantajlar">{esc(name)} aracının avantajları</h2><ul>
      <li>{esc(action.capitalize())} için tek bir odaklı çalışma ekranı sunar.</li>
      <li>Kaynak dosyanın üzerine yazmadan yeni bir {esc(output)} oluşturur.</li>
      <li>Bilgisayar, tablet ve modern mobil tarayıcılardan erişilebilir.</li>
      <li>İşlem öncesi adımları ve çıktı sınırlamalarını aynı sayfada açıklar.</li>
    </ul></section>
    <section class="landing-section" aria-labelledby="guvenlik"><p class="eyebrow">GÜVENLİK</p><h2 id="guvenlik">Dosyanız nasıl işlenir?</h2><p>{esc(security)}</p></section>
    <section class="landing-section" aria-labelledby="ipuclari"><p class="eyebrow">İPUÇLARI</p><h2 id="ipuclari">Daha iyi sonuç için öneriler</h2><ul>
      <li>İşleme başlamadan önce kaynak dosyanın yedek bir kopyasını saklayın.</li>
      <li>Dosya adında işlemin amacını anlatan kısa ve anlaşılır bir ifade kullanın.</li>
      <li>{esc(caveat)}</li>
      <li>İndirilen çıktıyı farklı bir uygulamada açarak içeriği ve sayfa düzenini kontrol edin.</li>
    </ul></section>
    <section class="landing-section faq-section" aria-labelledby="sss"><p class="eyebrow">MERAK EDİLENLER</p><h2 id="sss">Sık Sorulan Sorular</h2><div class="faq-list">{faq_html}</div></section>
    <section class="landing-section related-tools" aria-labelledby="ilgili-araclar"><p class="eyebrow">ÇALIŞMAYA DEVAM EDİN</p><h2 id="ilgili-araclar">İlgili araçlar</h2><div class="related-tool-grid">{related_cards}</div></section>
    <section class="landing-section" aria-labelledby="yardim"><p class="eyebrow">YARDIM</p><h2 id="yardim">BelgeLab hakkında bilgi ve destek</h2><div class="related-tool-grid">
      <a href="/hakkimizda.html"><strong>Hakkımızda</strong><span>BelgeLab'ın amacı ve çalışma yaklaşımı.</span></a>
      <a href="/iletisim.html"><strong>İletişim</strong><span>Soru ve geri bildirimleriniz için iletişim bilgileri.</span></a>
      <a href="/privacy.html"><strong>Gizlilik Politikası</strong><span>Veri ve gizlilik uygulamalarımızı inceleyin.</span></a>
      <a href="/terms.html"><strong>Kullanım Şartları</strong><span>Hizmetin kullanım koşullarını okuyun.</span></a>
    </div></section>
    <section class="landing-final-cta"><h2>{esc(name)} aracını kullanmaya başlayın</h2><a class="landing-cta" href="/?tool={esc(tool_id)}">{esc(cta)}</a></section>
  </main>
  <footer class="site-footer">
    <a class="footer-brand" href="/">BelgeLab</a><p>Belge araçları için bağımsız bir web uygulaması.</p>
    <nav aria-label="Yasal bağlantılar"><a href="/hakkimizda.html">Hakkımızda</a><a href="/belgelab-nedir.html">BelgeLab Nedir?</a><a href="/rehberler.html">Rehberler</a><a href="/iletisim.html">İletişim</a><a href="/kvkk.html">KVKK Aydınlatma</a><a href="/cookies.html">Çerez Politikası</a><a href="/privacy.html">Gizlilik Politikası</a><a href="/terms.html">Kullanım Koşulları</a><a href="/licenses.html">Açık Kaynak Lisansları</a><a href="#" data-open-consent>Çerez tercihleri</a></nav>
    <aside class="ad-slot footer-ad" data-ad-position="footer" aria-label="Reklam" hidden><span>Reklam</span></aside><small>© <span id="copyrightYear">2026</span> BelgeLab. Tüm hakları saklıdır.</small>
  </footer>
  <script src="/consent.js"></script><script src="/ads.js"></script>
</body>
</html>
"""


def main() -> None:
    for filename, config in TOOLS.items():
        path = ROOT / filename
        path.write_text(render(filename, config, path.read_text(encoding="utf-8")), encoding="utf-8")
    print(f"{len(TOOLS)} araç sayfası Araç Sayfası Standardı v1.0 ile üretildi.")


if __name__ == "__main__":
    main()
