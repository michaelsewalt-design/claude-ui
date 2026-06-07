/**
 * EXPORT.JS — v6
 * Volledige export module.
 * Fix: PPTX nu met slideMaster + slideLayout zodat PowerPoint slides correct opent.
 * Vereist: js/jszip.min.js + js/xlsx.full.min.js
 */

const Exporter = (() => {

  // ─── Hulpfuncties ─────────────────────────────────────────────

  function formatTimestamp(isoString) {
    return new Date(isoString).toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' });
  }

  function generateFilename(ext) {
    return 'claude-chat_' + new Date().toISOString().slice(0, 10) + ext;
  }

  function generateSingleFilename(ext) {
    return 'claude-antwoord_' + new Date().toISOString().slice(0, 10) + ext;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function getTextContent(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    return '';
  }

  function stripMarkdown(text) {
    return text
      .replace(/#{1,6}\s?/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`{1,3}([\s\S]*?)`{1,3}/g, '$1')
      .replace(/^\s*[-*+]\s/gm, '- ')
      .replace(/^\s*\d+\.\s/gm, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/^>\s?(.*)/gm, '$1')
      .replace(/---+/g, '________________________________________')
      .trim();
  }

  function markdownToHtml(text) {
    let h = text
      .replace(/^######\s(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s(.+)$/gm,  '<h5>$1</h5>')
      .replace(/^####\s(.+)$/gm,   '<h4>$1</h4>')
      .replace(/^###\s(.+)$/gm,    '<h3>$1</h3>')
      .replace(/^##\s(.+)$/gm,     '<h2>$1</h2>')
      .replace(/^#\s(.+)$/gm,      '<h1>$1</h1>')
      .replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>')
      .replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,        '<em>$1</em>')
      .replace(/`([^`]+)`/g,        '<code>$1</code>')
      .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/^>\s(.+)$/gm,       '<blockquote>$1</blockquote>')
      .replace(/^---+$/gm,          '<hr>')
      .replace(/^\s*[-*+]\s(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>')
      .replace(/^\d+\.\s(.+)$/gm,   '<li>$1</li>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return '<p>' + h + '</p>';
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&apos;');
  }

  // ─── PPTX builder ─────────────────────────────────────────────

  const SLIDE_W = 9144000;
  const SLIDE_H = 5143500;

  function parseSlidesFromText(text) {
    const clean = text.trim();

    // Poging 1: directe JSON array
    try {
      const p = JSON.parse(clean);
      if (Array.isArray(p) && p.length > 0) {
        return p.map(s => ({
          title:   String(s.title || 'Slide'),
          bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : [],
          notes:   s.notes ? String(s.notes) : ''
        }));
      }
    } catch(_) {}

    // Poging 2: JSON in code block
    const jsonMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const p2 = JSON.parse(jsonMatch[1].trim());
        if (Array.isArray(p2)) {
          return p2.map(s => ({
            title:   String(s.title || 'Slide'),
            bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : [],
            notes:   s.notes ? String(s.notes) : ''
          }));
        }
      } catch(_) {}
    }

    // Fallback: splits op ## koppen
    const slides = [];
    const sections = clean.split(/^#{1,3}\s/m).filter(s => s.trim());
    sections.forEach(section => {
      const lines   = section.split('\n').filter(l => l.trim());
      const title   = lines[0] || 'Slide';
      const bullets = lines.slice(1)
        .filter(l => l.trim())
        .map(l => l.replace(/^[-*+]\s/, '').trim())
        .slice(0, 6);
      slides.push({ title, bullets, notes: '' });
    });

    if (slides.length === 0) {
      slides.push({ title: 'Inhoud', bullets: [clean.slice(0, 200)], notes: '' });
    }
    return slides;
  }

  function buildSlideXml(slide) {
    const bulletXml = slide.bullets.length > 0
      ? slide.bullets.map(b =>
          '<a:p>' +
            '<a:pPr marL="342900" indent="-342900">' +
              '<a:buFont typeface="+mj-lt"/>' +
              '<a:buChar char="&#x2022;"/>' +
            '</a:pPr>' +
            '<a:r>' +
              '<a:rPr lang="nl-NL" sz="2000" dirty="0"/>' +
              '<a:t>' + escapeXml(b) + '</a:t>' +
            '</a:r>' +
          '</a:p>'
        ).join('')
      : '<a:p><a:endParaRPr lang="nl-NL" dirty="0"/></a:p>';

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
      ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:cSld>' +
        '<p:spTree>' +
          '<p:nvGrpSpPr>' +
            '<p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>' +
          '</p:nvGrpSpPr>' +
          '<p:grpSpPr>' +
            '<a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
            '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>' +
          '</p:grpSpPr>' +
          '<p:sp>' +
            '<p:nvSpPr>' +
              '<p:cNvPr id="2" name="Title"/>' +
              '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
              '<p:nvPr><p:ph type="title"/></p:nvPr>' +
            '</p:nvSpPr>' +
            '<p:spPr>' +
              '<a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="1143000"/></a:xfrm>' +
              '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
            '</p:spPr>' +
            '<p:txBody>' +
              '<a:bodyPr/><a:lstStyle/>' +
              '<a:p><a:r><a:rPr lang="nl-NL" sz="3600" b="1" dirty="0"/>' +
              '<a:t>' + escapeXml(slide.title) + '</a:t></a:r></a:p>' +
            '</p:txBody>' +
          '</p:sp>' +
          '<p:sp>' +
            '<p:nvSpPr>' +
              '<p:cNvPr id="3" name="Content"/>' +
              '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
              '<p:nvPr><p:ph idx="1"/></p:nvPr>' +
            '</p:nvSpPr>' +
            '<p:spPr>' +
              '<a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="8229600" cy="3766800"/></a:xfrm>' +
              '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
            '</p:spPr>' +
            '<p:txBody>' +
              '<a:bodyPr/><a:lstStyle/>' +
              bulletXml +
            '</p:txBody>' +
          '</p:sp>' +
        '</p:spTree>' +
      '</p:cSld>' +
      '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
      '</p:sld>';
  }

  const PPTX_SLIDE_MASTER =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
    ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>' +
    '<p:spTree>' +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    '</p:spTree></p:cSld>' +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2"' +
    ' accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    '<p:txStyles>' +
    '<p:titleStyle><a:lvl1pPr><a:defRPr sz="3600" b="1"/></a:lvl1pPr></p:titleStyle>' +
    '<p:bodyStyle><a:lvl1pPr><a:defRPr sz="2400"/></a:lvl1pPr></p:bodyStyle>' +
    '<p:otherStyle><a:lvl1pPr><a:defRPr/></a:lvl1pPr></p:otherStyle>' +
    '</p:txStyles>' +
    '</p:sldMaster>';

  const PPTX_SLIDE_LAYOUT =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
    ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="obj">' +
    '<p:cSld name="Title and Content"><p:spTree>' +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
    '<p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/>' +
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
    '<p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>' +
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>' +
    '</p:spTree></p:cSld>' +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
    '</p:sldLayout>';

  const PPTX_THEME =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">' +
    '<a:themeElements>' +
    '<a:clrScheme name="Office">' +
    '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
    '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="44546A"/></a:dk2>' +
    '<a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>' +
    '<a:accent1><a:srgbClr val="4472C4"/></a:accent1>' +
    '<a:accent2><a:srgbClr val="ED7D31"/></a:accent2>' +
    '<a:accent3><a:srgbClr val="A9D18E"/></a:accent3>' +
    '<a:accent4><a:srgbClr val="FFC000"/></a:accent4>' +
    '<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>' +
    '<a:accent6><a:srgbClr val="70AD47"/></a:accent6>' +
    '<a:hlink><a:srgbClr val="0563C1"/></a:hlink>' +
    '<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>' +
    '</a:clrScheme>' +
    '<a:fontScheme name="Office">' +
    '<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>' +
    '</a:fontScheme>' +
    '<a:fmtScheme name="Office">' +
    '<a:fillStyleLst>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '</a:fillStyleLst>' +
    '<a:lnStyleLst>' +
    '<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
    '<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
    '<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
    '</a:lnStyleLst>' +
    '<a:effectStyleLst>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>' +
    '</a:effectStyleLst>' +
    '<a:bgFillStyleLst>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '</a:bgFillStyleLst>' +
    '</a:fmtScheme>' +
    '</a:themeElements>' +
    '</a:theme>';

  async function buildPptxBlob(slides) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip niet geladen. Controleer js/jszip.min.js in je project.');
    }

    const zip = new JSZip();

    // [Content_Types].xml
    const slideOverrides = slides.map((_, i) =>
      '<Override PartName="/ppt/slides/slide' + (i+1) + '.xml"' +
      ' ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
    ).join('');

    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
      slideOverrides +
      '</Types>');

    // Root rels
    zip.file('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>' +
      '</Relationships>');

    // Presentation rels — rId1 = slideMaster, rId2+ = slides
    const presRels = slides.map((_, i) =>
      '<Relationship Id="rId' + (i+2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + (i+1) + '.xml"/>'
    ).join('');

    zip.file('ppt/_rels/presentation.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>' +
      presRels +
      '</Relationships>');

    // Presentation.xml — sldIds verwijzen naar rId2+
    const sldIds = slides.map((_, i) =>
      '<p:sldId id="' + (256+i) + '" r:id="rId' + (i+2) + '"/>'
    ).join('');

    zip.file('ppt/presentation.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
      ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
      '<p:sldIdLst>' + sldIds + '</p:sldIdLst>' +
      '<p:sldSz cx="' + SLIDE_W + '" cy="' + SLIDE_H + '" type="screen16x9"/>' +
      '<p:notesSz cx="6858000" cy="9144000"/>' +
      '</p:presentation>');

    // slideMaster + rels
    zip.file('ppt/slideMasters/slideMaster1.xml', PPTX_SLIDE_MASTER);
    zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>' +
      '</Relationships>');

    // slideLayout + rels
    zip.file('ppt/slideLayouts/slideLayout1.xml', PPTX_SLIDE_LAYOUT);
    zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>' +
      '</Relationships>');

    // Theme
    zip.file('ppt/theme/theme1.xml', PPTX_THEME);

    // Slides
    slides.forEach((slide, i) => {
      zip.file('ppt/slides/slide' + (i+1) + '.xml', buildSlideXml(slide));
      zip.file('ppt/slides/_rels/slide' + (i+1) + '.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
        '</Relationships>');
    });

    return zip.generateAsync({
      type:        'blob',
      mimeType:    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      compression: 'DEFLATE'
    });
  }

  // ─── DOCX builder ─────────────────────────────────────────────

  function buildParagraph(text, style, bold, italic) {
    const pPr = '<w:pPr><w:pStyle w:val="' + (style || 'Normal') + '"/></w:pPr>';
    if (!text || !text.trim()) return '<w:p>' + pPr + '</w:p>';
    const rPr = (bold || italic)
      ? '<w:rPr>' + (bold ? '<w:b/><w:bCs/>' : '') + (italic ? '<w:i/><w:iCs/>' : '') + '</w:rPr>'
      : '';
    return '<w:p>' + pPr + '<w:r>' + rPr + '<w:t xml:space="preserve">' + escapeXml(text) + '</w:t></w:r></w:p>';
  }

  function buildDocumentXml(paragraphs) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' +
      paragraphs.map(p => buildParagraph(p.text, p.style, p.bold, p.italic)).join('') +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>' +
      '</w:body></w:document>';
  }

  async function buildDocxBlob(paragraphs) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip niet geladen.');
    const zip = new JSZip();
    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>');
    zip.file('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>');
    zip.file('word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>');
    zip.file('word/document.xml', buildDocumentXml(paragraphs));
    zip.file('word/styles.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr>' +
      '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="24"/>' +
      '</w:rPr></w:rPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>' +
      '<w:rPr><w:sz w:val="24"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="40"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="32"/></w:rPr></w:style>' +
      '</w:styles>');
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  }

  function textToParagraphs(text) {
    return stripMarkdown(text).split('\n').filter(l => l.trim())
      .map(l => ({ text: l.trim(), style: 'Normal', bold: false, italic: false }));
  }

  // ─── Export: volledige chat ────────────────────────────────────

  function exportMarkdown(messages) {
    const lines = ['# Claude AI — Chat Export', '', '> Geexporteerd: ' + formatTimestamp(new Date().toISOString()), '', '---', ''];
    messages.forEach(msg => {
      const role = msg.role === 'user' ? '**Jij**' : '**Claude**';
      const time = msg.timestamp ? '*' + formatTimestamp(msg.timestamp) + '*' : '';
      lines.push('### ' + role + ' ' + time, '', getTextContent(msg.content), '', '---', '');
    });
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), generateFilename('.md'));
  }

  function exportTxt(messages) {
    const lines = ['CLAUDE AI - CHAT EXPORT', '='.repeat(50), 'Geexporteerd: ' + formatTimestamp(new Date().toISOString()), '='.repeat(50), ''];
    messages.forEach(msg => {
      lines.push('[' + (msg.role === 'user' ? 'JIJ' : 'CLAUDE') + '] ' + (msg.timestamp ? formatTimestamp(msg.timestamp) : ''),
        '-'.repeat(40), stripMarkdown(getTextContent(msg.content)), '');
    });
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), generateFilename('.txt'));
  }

  function exportHtml(messages) {
    const body = messages.map(msg => {
      const role      = msg.role === 'user' ? 'Jij' : 'Claude';
      const roleClass = msg.role === 'user' ? 'user' : 'ai';
      const time      = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
      return '<div class="message message--' + roleClass + '">' +
        '<div class="message-header"><span class="role">' + role + '</span><span class="time">' + time + '</span></div>' +
        '<div class="content">' + markdownToHtml(getTextContent(msg.content)) + '</div></div>';
    }).join('');
    triggerDownload(new Blob([buildHtmlWrapper('Claude AI - Chat Export', 'Geexporteerd: ' + formatTimestamp(new Date().toISOString()), body)], { type: 'text/html;charset=utf-8' }), generateFilename('.html'));
  }

  function exportJson(messages) {
    const data = { export: { timestamp: new Date().toISOString(), messageCount: messages.length },
      messages: messages.map(m => ({ role: m.role, content: getTextContent(m.content), timestamp: m.timestamp || null })) };
    triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), generateFilename('.json'));
  }

  function exportCsv(messages) {
    const rows = [['rol', 'inhoud', 'tijdstip']];
    messages.forEach(msg => {
      const clean = getTextContent(msg.content).replace(/"/g, '""').replace(/\n/g, ' ');
      rows.push([msg.role, '"' + clean + '"', msg.timestamp ? formatTimestamp(msg.timestamp) : '']);
    });
    triggerDownload(new Blob(['\uFEFF' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }), generateFilename('.csv'));
  }

  async function exportDocx(messages) {
    const paragraphs = [
      { text: 'Claude AI - Chat Export', style: 'Heading1', bold: true, italic: false },
      { text: 'Geexporteerd: ' + formatTimestamp(new Date().toISOString()), style: 'Normal', bold: false, italic: true },
      { text: '', style: 'Normal', bold: false, italic: false }
    ];
    messages.forEach(msg => {
      paragraphs.push({ text: (msg.role === 'user' ? 'Jij' : 'Claude') + (msg.timestamp ? ' - ' + formatTimestamp(msg.timestamp) : ''), style: 'Heading2', bold: true, italic: false });
      textToParagraphs(getTextContent(msg.content)).forEach(p => paragraphs.push(p));
      paragraphs.push({ text: '', style: 'Normal', bold: false, italic: false });
    });
    triggerDownload(await buildDocxBlob(paragraphs), generateFilename('.docx'));
  }

  function exportExcel(messages) {
    if (typeof XLSX === 'undefined') { alert('SheetJS niet geladen.'); return; }
    const wb = XLSX.utils.book_new();
    const rows = [['Tijdstip', 'Rol', 'Inhoud']];
    messages.forEach(msg => rows.push([
      msg.timestamp ? formatTimestamp(msg.timestamp) : '',
      msg.role === 'user' ? 'Jij' : 'Claude',
      stripMarkdown(getTextContent(msg.content))
    ]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Chat');
    triggerDownload(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), generateFilename('.xlsx'));
  }

  function exportPdf(messages) {
    const msgHtml = messages.map(msg => {
      const role      = msg.role === 'user' ? 'Jij' : 'Claude';
      const roleClass = msg.role === 'user' ? 'user' : 'ai';
      const time      = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
      const plain     = stripMarkdown(getTextContent(msg.content));
      return '<div class="msg msg--' + roleClass + '">' +
        '<div class="msg-head"><strong>' + role + '</strong><span>' + time + '</span></div>' +
        '<div class="msg-body">' + plain.split('\n').filter(l => l.trim()).map(l => '<p>' + l + '</p>').join('') + '</div></div>';
    }).join('');
    openPrintWindow('Claude AI - Chat Export', 'Geexporteerd: ' + formatTimestamp(new Date().toISOString()) + ' - ' + messages.length + ' berichten', msgHtml);
  }

  async function exportPowerPoint(messages) {
    const lastAi = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAi) { alert('Geen Claude antwoord gevonden.'); return; }
    const slides = parseSlidesFromText(getTextContent(lastAi.content));
    triggerDownload(await buildPptxBlob(slides), generateFilename('.pptx'));
  }

  // ─── Export: enkel antwoord ───────────────────────────────────

  async function exportSingleMessage(text, format) {
    switch (format) {
      case 'docx': {
        const paragraphs = [
          { text: 'Claude - Antwoord', style: 'Heading1', bold: true, italic: false },
          { text: formatTimestamp(new Date().toISOString()), style: 'Normal', bold: false, italic: true },
          { text: '', style: 'Normal', bold: false, italic: false },
          ...textToParagraphs(text)
        ];
        triggerDownload(await buildDocxBlob(paragraphs), generateSingleFilename('.docx'));
        break;
      }
      case 'powerpoint': {
        const slides = parseSlidesFromText(text);
        triggerDownload(await buildPptxBlob(slides), generateSingleFilename('.pptx'));
        break;
      }
      case 'excel': {
        if (typeof XLSX === 'undefined') { alert('SheetJS niet geladen.'); return; }
        const tableData = parseTableData(text);
        const wb2 = XLSX.utils.book_new();
        const ws2 = XLSX.utils.aoa_to_sheet(tableData);
        if (tableData[0]) {
          ws2['!cols'] = tableData[0].map((_, ci) => ({
            wch: Math.min(60, Math.max(10, ...tableData.map(row => String(row[ci] || '').length)))
          }));
        }
        XLSX.utils.book_append_sheet(wb2, ws2, 'Antwoord');
        triggerDownload(new Blob([XLSX.write(wb2, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), generateSingleFilename('.xlsx'));
        break;
      }
      case 'pdf': {
        const plain = stripMarkdown(text);
        openPrintWindow('Claude - Antwoord', formatTimestamp(new Date().toISOString()),
          '<div class="msg msg--ai"><div class="msg-body">' +
          plain.split('\n').filter(l => l.trim()).map(l => '<p>' + l + '</p>').join('') +
          '</div></div>');
        break;
      }
      case 'html': {
        const htmlBody = '<div class="message message--ai">' +
          '<div class="message-header"><span class="role">Claude</span><span class="time">' + formatTimestamp(new Date().toISOString()) + '</span></div>' +
          '<div class="content">' + markdownToHtml(text) + '</div></div>';
        triggerDownload(new Blob([buildHtmlWrapper('Claude - Antwoord', formatTimestamp(new Date().toISOString()), htmlBody)], { type: 'text/html;charset=utf-8' }), generateSingleFilename('.html'));
        break;
      }
      case 'markdown':
        triggerDownload(new Blob(['# Claude - Antwoord\n\n> ' + formatTimestamp(new Date().toISOString()) + '\n\n---\n\n' + text], { type: 'text/markdown;charset=utf-8' }), generateSingleFilename('.md'));
        break;
      default:
        triggerDownload(new Blob(['CLAUDE - ANTWOORD\n' + '='.repeat(50) + '\n' + formatTimestamp(new Date().toISOString()) + '\n' + '='.repeat(50) + '\n\n' + stripMarkdown(text)], { type: 'text/plain;charset=utf-8' }), generateSingleFilename('.txt'));
    }
  }

  function parseTableData(text) {
    const clean = text.trim();
    try { const p = JSON.parse(clean); if (Array.isArray(p)) return p.map(r => Array.isArray(r) ? r : [String(r)]); } catch(_) {}
    const m = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) { try { const p2 = JSON.parse(m[1].trim()); if (Array.isArray(p2)) return p2; } catch(_) {} }
    return clean.split('\n').filter(l => l.trim()).map(line => {
      const sep = line.includes('\t') ? '\t' : ',';
      return line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    });
  }

  // ─── Gedeelde helpers ─────────────────────────────────────────

  function openPrintWindow(title, meta, bodyHtml) {
    const html = '<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>' + title + '</title>' +
      '<style>@page{margin:20mm;size:A4}body{font-family:"Segoe UI",sans-serif;font-size:11pt;color:#1a1a1a;line-height:1.6}' +
      'h1{font-size:18pt;margin-bottom:4pt}.meta{font-size:9pt;color:#666;margin-bottom:20pt;border-bottom:1pt solid #ddd;padding-bottom:8pt}' +
      '.msg{margin-bottom:14pt;border:1pt solid #ddd;border-radius:4pt;overflow:hidden;page-break-inside:avoid}' +
      '.msg-head{display:flex;justify-content:space-between;padding:6pt 10pt;background:#f0ede8;font-size:9pt}' +
      '.msg--ai .msg-head{background:#1a1a1a;color:#fff}.msg-body{padding:10pt;font-size:10.5pt}' +
      '.msg-body p{margin:0 0 6pt}.msg-body p:last-child{margin:0}</style></head><body>' +
      '<h1>' + title + '</h1><div class="meta">' + meta + '</div>' + bodyHtml + '</body></html>';
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Sta pop-ups toe om PDF te exporteren.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  }

  function buildHtmlWrapper(title, meta, bodyHtml) {
    return '<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>' + title + '</title>' +
      '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI",system-ui,sans-serif;background:#f8f7f5;color:#1a1a1a;line-height:1.7;padding:40px 20px}' +
      '.container{max-width:800px;margin:0 auto}header{border-bottom:2px solid #1a1a1a;padding-bottom:16px;margin-bottom:32px}' +
      'header h1{font-size:22px;font-weight:700}header .meta{font-size:13px;color:#666;margin-top:4px}' +
      '.message{margin-bottom:20px;border-radius:10px;overflow:hidden;border:1px solid #e0ddd8}' +
      '.message-header{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#f0ede8;border-bottom:1px solid #e0ddd8}' +
      '.message--ai .message-header{background:#1a1a1a;color:#f0f0f0}.role{font-weight:700;font-size:13px}.time{font-size:11px;color:#888}' +
      '.content{padding:16px;background:#fff;font-size:14px}.message--ai .content{background:#fafaf9}' +
      '.content p{margin-bottom:10px}.content p:last-child{margin-bottom:0}' +
      '.content h1,.content h2,.content h3{font-weight:700;margin:16px 0 8px}' +
      '.content ul,.content ol{padding-left:20px;margin:8px 0}.content li{margin-bottom:4px}' +
      '.content code{background:#f0ede8;padding:2px 6px;border-radius:4px;font-family:monospace}' +
      'footer{margin-top:40px;text-align:center;font-size:12px;color:#999;border-top:1px solid #e0ddd8;padding-top:16px}' +
      '</style></head><body><div class="container">' +
      '<header><h1>' + title + '</h1><div class="meta">' + meta + '</div></header>' +
      bodyHtml +
      '<footer>Gegenereerd via Claude AI Persoonlijke Interface</footer>' +
      '</div></body></html>';
  }

  // ─── Publieke API ──────────────────────────────────────────────

  async function exportChat(messages, format) {
    if (!messages || messages.length === 0) { alert('Er zijn geen berichten om te exporteren.'); return; }
    switch (format) {
      case 'markdown':   exportMarkdown(messages);         break;
      case 'txt':        exportTxt(messages);              break;
      case 'html':       exportHtml(messages);             break;
      case 'json':       exportJson(messages);             break;
      case 'csv':        exportCsv(messages);              break;
      case 'pdf':        exportPdf(messages);              break;
      case 'excel':      exportExcel(messages);            break;
      case 'powerpoint': await exportPowerPoint(messages); break;
      case 'docx':       await exportDocx(messages);       break;
      default:           exportMarkdown(messages);
    }
  }

  return { exportChat, exportSingleMessage };

})();


