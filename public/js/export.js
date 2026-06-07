/**
 * EXPORT.JS — v5
 * Volledig herschreven export module.
 * Nieuw: PowerPoint (.pptx) export via JSZip
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
    setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
  }

  function getTextContent(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.filter(function(c) { return c.type === 'text'; }).map(function(c) { return c.text; }).join('\n');
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
    var h = text
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
      .replace(/(<li>.*<\/li>\n?)+/g, function(m) { return '<ul>' + m + '</ul>'; })
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

  /**
   * Parse Claude antwoord naar slide data.
   * Verwacht JSON array: [{title, bullets[], notes?}]
   * Fallback: splits op koppen als JSON niet lukt.
   */
  function parseSlidesFromText(text) {
    var clean = text.trim();

    // Poging 1: directe JSON array
    try {
      var parsed = JSON.parse(clean);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(function(s) {
          return {
            title:   String(s.title || 'Slide'),
            bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : [],
            notes:   s.notes ? String(s.notes) : ''
          };
        });
      }
    } catch(_) {}

    // Poging 2: JSON in code block
    var jsonMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        var parsed2 = JSON.parse(jsonMatch[1].trim());
        if (Array.isArray(parsed2)) {
          return parsed2.map(function(s) {
            return {
              title:   String(s.title || 'Slide'),
              bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : [],
              notes:   s.notes ? String(s.notes) : ''
            };
          });
        }
      } catch(_) {}
    }

    // Fallback: splits op ## koppen
    var slides = [];
    var sections = clean.split(/^#{1,3}\s/m).filter(function(s) { return s.trim(); });
    sections.forEach(function(section) {
      var lines   = section.split('\n').filter(function(l) { return l.trim(); });
      var title   = lines[0] || 'Slide';
      var bullets = lines.slice(1)
        .filter(function(l) { return l.trim(); })
        .map(function(l) { return l.replace(/^[-*+]\s/, '').trim(); })
        .slice(0, 6);
      slides.push({ title: title, bullets: bullets, notes: '' });
    });

    if (slides.length === 0) {
      slides.push({ title: 'Inhoud', bullets: [clean.slice(0, 200)], notes: '' });
    }
    return slides;
  }

  // EMU = English Metric Units (1 inch = 914400 EMU)
  // Standaard slide: 9144000 x 5143500 EMU (widescreen 16:9)
  var SLIDE_W = 9144000;
  var SLIDE_H = 5143500;

  // Kleuren palet (donker thema passend bij de UI)
  var COLOR_BG      = '1a1a2e';  // donkerblauw
  var COLOR_ACCENT  = 'e8c547';  // goud/geel
  var COLOR_TEXT    = 'f0efee';  // lichtgrijs
  var COLOR_MUTED   = '9b9aa0';  // grijs
  var COLOR_SLIDE2  = '16213e';  // iets lichter blauw voor content slides

  function buildSlideXml(slide, slideIndex, totalSlides) {
    var isTitle = slideIndex === 0;
    var bgColor = isTitle ? COLOR_BG : COLOR_SLIDE2;

    // Titel tekst
    var titleXml = '<a:r><a:rPr lang="nl-NL" sz="' + (isTitle ? '4000' : '3200') + '" b="1" dirty="0">' +
      '<a:solidFill><a:srgbClr val="' + (isTitle ? COLOR_ACCENT : COLOR_TEXT) + '"/></a:solidFill>' +
      '<a:latin typeface="Calibri"/></a:rPr>' +
      '<a:t>' + escapeXml(slide.title) + '</a:t></a:r>';

    // Bullets
    var bulletsXml = '';
    slide.bullets.forEach(function(bullet) {
      bulletsXml +=
        '<a:p>' +
          '<a:pPr marL="228600" indent="-228600">' +
            '<a:buChar char="&#x25AA;"/>' +
            '<a:buClr><a:srgbClr val="' + COLOR_ACCENT + '"/></a:buClr>' +
            '<a:buSzPct val="80000"/>' +
          '</a:pPr>' +
          '<a:r><a:rPr lang="nl-NL" sz="1800" dirty="0">' +
            '<a:solidFill><a:srgbClr val="' + COLOR_TEXT + '"/></a:solidFill>' +
            '<a:latin typeface="Calibri"/>' +
          '</a:rPr>' +
          '<a:t>' + escapeXml(bullet) + '</a:t></a:r>' +
        '</a:p>';
    });

    // Slide nummer (rechtsonder)
    var slideNumXml = '<p:sp><p:nvSpPr><p:cNvPr id="5" name="SlideNum"/>' +
      '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
      '<p:nvPr><p:ph type="sldNum" sz="quarter" idx="12"/></p:nvPr></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="' + (SLIDE_W - 1200000) + '" y="' + (SLIDE_H - 400000) + '"/>' +
      '<a:ext cx="1000000" cy="300000"/></a:xfrm></p:spPr>' +
      '<p:txBody><a:bodyPr/><a:lstStyle/>' +
      '<a:p><a:r><a:rPr lang="nl-NL" sz="1000" dirty="0">' +
      '<a:solidFill><a:srgbClr val="' + COLOR_MUTED + '"/></a:solidFill></a:rPr>' +
      '<a:t>' + (slideIndex + 1) + ' / ' + totalSlides + '</a:t></a:r></a:p>' +
      '</p:txBody></p:sp>';

    // Accent lijn bovenaan
    var lineXml = '<p:sp><p:nvSpPr><p:cNvPr id="6" name="AccentLine"/>' +
      '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
      '<p:nvPr/></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + SLIDE_W + '" cy="60000"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
      '<a:solidFill><a:srgbClr val="' + COLOR_ACCENT + '"/></a:solidFill>' +
      '<a:ln><a:noFill/></a:ln></p:spPr>' +
      '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>';

    var titleY  = isTitle ? 1800000 : 400000;
    var titleH  = isTitle ? 1200000 : 900000;
    var contentY = isTitle ? 3200000 : 1400000;
    var contentH = isTitle ? 1200000 : 3400000;

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
      ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:cSld>' +
        '<p:bg><p:bgPr>' +
          '<a:solidFill><a:srgbClr val="' + bgColor + '"/></a:solidFill>' +
          '<a:effectLst/>' +
        '</p:bgPr></p:bg>' +
        '<p:spTree>' +
          '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
          '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
          '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
          lineXml +
          '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/>' +
            '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
            '<p:nvPr/></p:nvSpPr>' +
            '<p:spPr><a:xfrm><a:off x="457200" y="' + titleY + '"/>' +
            '<a:ext cx="' + (SLIDE_W - 914400) + '" cy="' + titleH + '"/></a:xfrm>' +
            '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
            '<p:txBody><a:bodyPr wrap="square" rtlCol="0"><a:normAutofit/></a:bodyPr>' +
            '<a:lstStyle/><a:p>' + titleXml + '</a:p></p:txBody>' +
          '</p:sp>' +
          (slide.bullets.length > 0 ?
            '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/>' +
              '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
              '<p:nvPr/></p:nvSpPr>' +
              '<p:spPr><a:xfrm><a:off x="457200" y="' + contentY + '"/>' +
              '<a:ext cx="' + (SLIDE_W - 914400) + '" cy="' + contentH + '"/></a:xfrm>' +
              '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
              '<p:txBody><a:bodyPr wrap="square" rtlCol="0"><a:normAutofit/></a:bodyPr>' +
              '<a:lstStyle/>' + bulletsXml + '</p:txBody>' +
            '</p:sp>' : '') +
          slideNumXml +
        '</p:spTree>' +
      '</p:cSld>' +
      '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
      '</p:sld>';
  }

  function buildSlideRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '</Relationships>';
  }

  function buildNoteXml(notes, slideIndex) {
    var noteText = notes || ('Slide ' + (slideIndex + 1));
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
      ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:cSld><p:spTree>' +
      '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
      '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
      '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes"/>' +
      '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
      '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>' +
      '<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>' +
      '<a:p><a:r><a:rPr lang="nl-NL" dirty="0"/>' +
      '<a:t>' + escapeXml(noteText) + '</a:t></a:r></a:p>' +
      '</p:txBody></p:sp>' +
      '</p:spTree></p:cSld></p:notes>';
  }

  async function buildPptxBlob(slides) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip niet geladen. Controleer js/jszip.min.js in je project.');
    }

    var zip = new JSZip();

    // [Content_Types].xml
    var slideEntries = slides.map(function(_, i) {
      return '<Override PartName="/ppt/slides/slide' + (i + 1) + '.xml"' +
        ' ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' +
        '<Override PartName="/ppt/notesSlides/notesSlide' + (i + 1) + '.xml"' +
        ' ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>';
    }).join('');

    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/ppt/presentation.xml"' +
      ' ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '<Override PartName="/ppt/theme/theme1.xml"' +
      ' ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
      slideEntries +
      '</Types>');

    // _rels/.rels
    zip.file('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1"' +
      ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"' +
      ' Target="ppt/presentation.xml"/>' +
      '</Relationships>');

    // ppt/presentation.xml
    var sldIdList = slides.map(function(_, i) {
      return '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 1) + '"/>';
    }).join('');

    zip.file('ppt/presentation.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
      ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"' +
      ' saveSubsetFonts="1">' +
      '<p:sldMasterIdLst/>' +
      '<p:sldSz cx="' + SLIDE_W + '" cy="' + SLIDE_H + '" type="screen16x9"/>' +
      '<p:notesSz cx="6858000" cy="9144000"/>' +
      '<p:sldIdLst>' + sldIdList + '</p:sldIdLst>' +
      '</p:presentation>');

    // ppt/_rels/presentation.xml.rels
    var presRels = slides.map(function(_, i) {
      return '<Relationship Id="rId' + (i + 1) + '"' +
        ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"' +
        ' Target="slides/slide' + (i + 1) + '.xml"/>';
    }).join('');

    zip.file('ppt/_rels/presentation.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      presRels +
      '</Relationships>');

    // Slides + notes
    slides.forEach(function(slide, i) {
      var slideXml = buildSlideXml(slide, i, slides.length);
      var noteXml  = buildNoteXml(slide.notes, i);
      var slideNum = i + 1;

      zip.file('ppt/slides/slide' + slideNum + '.xml', slideXml);
      zip.file('ppt/notesSlides/notesSlide' + slideNum + '.xml', noteXml);

      // Slide rels (leeg — geen afbeeldingen of masters)
      zip.file('ppt/slides/_rels/slide' + slideNum + '.xml.rels', buildSlideRels());
      zip.file('ppt/notesSlides/_rels/notesSlide' + slideNum + '.xml.rels', buildSlideRels());
    });

    // Minimale theme (vereist door PowerPoint)
    zip.file('ppt/theme/theme1.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="ClaudeTheme">' +
      '<a:themeElements>' +
      '<a:clrScheme name="Claude">' +
      '<a:dk1><a:srgbClr val="' + COLOR_BG + '"/></a:dk1>' +
      '<a:lt1><a:srgbClr val="' + COLOR_TEXT + '"/></a:lt1>' +
      '<a:dk2><a:srgbClr val="' + COLOR_SLIDE2 + '"/></a:dk2>' +
      '<a:lt2><a:srgbClr val="' + COLOR_MUTED + '"/></a:lt2>' +
      '<a:accent1><a:srgbClr val="' + COLOR_ACCENT + '"/></a:accent1>' +
      '<a:accent2><a:srgbClr val="e05c5c"/></a:accent2>' +
      '<a:accent3><a:srgbClr val="52c97a"/></a:accent3>' +
      '<a:accent4><a:srgbClr val="8ab4f8"/></a:accent4>' +
      '<a:accent5><a:srgbClr val="c084fc"/></a:accent5>' +
      '<a:accent6><a:srgbClr val="f97316"/></a:accent6>' +
      '<a:hlink><a:srgbClr val="' + COLOR_ACCENT + '"/></a:hlink>' +
      '<a:folHlink><a:srgbClr val="' + COLOR_MUTED + '"/></a:folHlink>' +
      '</a:clrScheme>' +
      '<a:fontScheme name="Claude">' +
      '<a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
      '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>' +
      '</a:fontScheme>' +
      '<a:fmtScheme name="Claude"><a:fillStyleLst>' +
      '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
      '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
      '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
      '</a:fillStyleLst><a:lnStyleLst>' +
      '<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
      '<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
      '<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
      '</a:lnStyleLst><a:effectStyleLst>' +
      '<a:effectStyle><a:effectLst/></a:effectStyle>' +
      '<a:effectStyle><a:effectLst/></a:effectStyle>' +
      '<a:effectStyle><a:effectLst/></a:effectStyle>' +
      '</a:effectStyleLst><a:bgFillStyleLst>' +
      '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
      '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
      '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
      '</a:bgFillStyleLst></a:fmtScheme>' +
      '</a:themeElements></a:theme>');

    return zip.generateAsync({
      type:        'blob',
      mimeType:    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      compression: 'DEFLATE'
    });
  }

  // ─── DOCX builder ─────────────────────────────────────────────

  function buildParagraph(text, style, bold, italic) {
    var pPr = '<w:pPr><w:pStyle w:val="' + (style || 'Normal') + '"/></w:pPr>';
    if (!text || !text.trim()) return '<w:p>' + pPr + '</w:p>';
    var rPr = '';
    if (bold || italic) {
      rPr = '<w:rPr>' + (bold ? '<w:b/><w:bCs/>' : '') + (italic ? '<w:i/><w:iCs/>' : '') + '</w:rPr>';
    }
    return '<w:p>' + pPr + '<w:r>' + rPr + '<w:t xml:space="preserve">' + escapeXml(text) + '</w:t></w:r></w:p>';
  }

  function buildDocumentXml(paragraphs) {
    var body = paragraphs.map(function(p) {
      return buildParagraph(p.text, p.style, p.bold, p.italic);
    }).join('\n    ');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<w:body>' + body +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>' +
      '</w:body></w:document>';
  }

  var DOCX_CONTENT_TYPES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '</Types>';

  var DOCX_ROOT_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  var DOCX_WORD_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  var DOCX_STYLES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr>' +
    '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>' +
    '<w:rPr><w:sz w:val="24"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>' +
    '<w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="40"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>' +
    '<w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="32"/></w:rPr></w:style>' +
    '</w:styles>';

  async function buildDocxBlob(paragraphs) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip niet geladen. Controleer js/jszip.min.js.');
    var zip = new JSZip();
    zip.file('[Content_Types].xml', DOCX_CONTENT_TYPES);
    zip.file('_rels/.rels', DOCX_ROOT_RELS);
    zip.file('word/document.xml', buildDocumentXml(paragraphs));
    zip.file('word/styles.xml', DOCX_STYLES);
    zip.file('word/_rels/document.xml.rels', DOCX_WORD_RELS);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  }

  function textToParagraphs(text) {
    return stripMarkdown(text).split('\n').filter(function(l) { return l.trim(); })
      .map(function(l) { return { text: l.trim(), style: 'Normal', bold: false, italic: false }; });
  }

  // ─── Export: volledige chat ────────────────────────────────────

  function exportMarkdown(messages) {
    var lines = ['# Claude AI — Chat Export', '', '> Geexporteerd: ' + formatTimestamp(new Date().toISOString()), '', '---', ''];
    messages.forEach(function(msg) {
      var role = msg.role === 'user' ? '**Jij**' : '**Claude**';
      var time = msg.timestamp ? '*' + formatTimestamp(msg.timestamp) + '*' : '';
      lines.push('### ' + role + ' ' + time, '', getTextContent(msg.content), '', '---', '');
    });
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }), generateFilename('.md'));
  }

  function exportTxt(messages) {
    var sep  = '==================================================';
    var sep2 = '--------------------------------------------------';
    var lines = ['CLAUDE AI - CHAT EXPORT', sep, 'Geexporteerd: ' + formatTimestamp(new Date().toISOString()), sep, ''];
    messages.forEach(function(msg) {
      var role = msg.role === 'user' ? 'JIJ' : 'CLAUDE';
      var time = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
      lines.push('[' + role + '] ' + time, sep2, stripMarkdown(getTextContent(msg.content)), '');
    });
    triggerDownload(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), generateFilename('.txt'));
  }

  function exportHtml(messages) {
    var body = messages.map(function(msg) {
      var role      = msg.role === 'user' ? 'Jij' : 'Claude';
      var roleClass = msg.role === 'user' ? 'user' : 'ai';
      var time      = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
      return '<div class="message message--' + roleClass + '">' +
        '<div class="message-header"><span class="role">' + role + '</span><span class="time">' + time + '</span></div>' +
        '<div class="content">' + markdownToHtml(getTextContent(msg.content)) + '</div></div>';
    }).join('\n');
    triggerDownload(new Blob([buildHtmlWrapper('Claude AI - Chat Export', 'Geexporteerd: ' + formatTimestamp(new Date().toISOString()) + ' - ' + messages.length + ' berichten', body)], { type: 'text/html;charset=utf-8' }), generateFilename('.html'));
  }

  function exportJson(messages) {
    var data = {
      export: { timestamp: new Date().toISOString(), messageCount: messages.length },
      messages: messages.map(function(m) { return { role: m.role, content: getTextContent(m.content), timestamp: m.timestamp || null }; })
    };
    triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), generateFilename('.json'));
  }

  function exportCsv(messages) {
    var rows = [['rol', 'inhoud', 'tijdstip']];
    messages.forEach(function(msg) {
      var clean = getTextContent(msg.content).replace(/"/g, '""').replace(/\n/g, ' ');
      rows.push([msg.role, '"' + clean + '"', msg.timestamp ? formatTimestamp(msg.timestamp) : '']);
    });
    triggerDownload(new Blob(['\uFEFF' + rows.map(function(r) { return r.join(','); }).join('\n')], { type: 'text/csv;charset=utf-8' }), generateFilename('.csv'));
  }

  async function exportDocx(messages) {
    var paragraphs = [
      { text: 'Claude AI - Chat Export', style: 'Heading1', bold: true,  italic: false },
      { text: 'Geexporteerd: ' + formatTimestamp(new Date().toISOString()), style: 'Normal', bold: false, italic: true },
      { text: '', style: 'Normal', bold: false, italic: false }
    ];
    messages.forEach(function(msg) {
      var role = msg.role === 'user' ? 'Jij' : 'Claude';
      var time = msg.timestamp ? ' - ' + formatTimestamp(msg.timestamp) : '';
      paragraphs.push({ text: role + time, style: 'Heading2', bold: true, italic: false });
      textToParagraphs(getTextContent(msg.content)).forEach(function(p) { paragraphs.push(p); });
      paragraphs.push({ text: '', style: 'Normal', bold: false, italic: false });
    });
    triggerDownload(await buildDocxBlob(paragraphs), generateFilename('.docx'));
  }

  function exportExcel(messages) {
    if (typeof XLSX === 'undefined') { alert('SheetJS niet geladen. Controleer js/xlsx.full.min.js.'); return; }
    var wb = XLSX.utils.book_new();
    var chatRows = [['Tijdstip', 'Rol', 'Inhoud']];
    messages.forEach(function(msg) {
      chatRows.push([
        msg.timestamp ? formatTimestamp(msg.timestamp) : '',
        msg.role === 'user' ? 'Jij' : 'Claude',
        stripMarkdown(getTextContent(msg.content))
      ]);
    });
    var ws = XLSX.utils.aoa_to_sheet(chatRows);
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Chat');
    var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    triggerDownload(new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), generateFilename('.xlsx'));
  }

  function exportPdf(messages) {
    var msgHtml = messages.map(function(msg) {
      var role      = msg.role === 'user' ? 'Jij' : 'Claude';
      var roleClass = msg.role === 'user' ? 'user' : 'ai';
      var time      = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
      var plain     = stripMarkdown(getTextContent(msg.content));
      return '<div class="msg msg--' + roleClass + '">' +
        '<div class="msg-head"><strong>' + role + '</strong><span>' + time + '</span></div>' +
        '<div class="msg-body">' + plain.split('\n').filter(function(l) { return l.trim(); }).map(function(l) { return '<p>' + l + '</p>'; }).join('') + '</div></div>';
    }).join('');
    openPrintWindow('Claude AI - Chat Export', 'Geexporteerd: ' + formatTimestamp(new Date().toISOString()) + ' - ' + messages.length + ' berichten', msgHtml);
  }

  async function exportPowerPoint(messages) {
    var lastAi = null;
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') { lastAi = messages[i]; break; }
    }
    if (!lastAi) { alert('Geen Claude antwoord gevonden om te exporteren.'); return; }
    var slides = parseSlidesFromText(getTextContent(lastAi.content));
    triggerDownload(await buildPptxBlob(slides), generateFilename('.pptx'));
  }

  // ─── Export: enkel antwoord ───────────────────────────────────

  async function exportSingleMessage(text, format) {
    switch (format) {
      case 'docx': {
        var paragraphs = [
          { text: 'Claude - Antwoord', style: 'Heading1', bold: true, italic: false },
          { text: formatTimestamp(new Date().toISOString()), style: 'Normal', bold: false, italic: true },
          { text: '', style: 'Normal', bold: false, italic: false }
        ].concat(textToParagraphs(text));
        triggerDownload(await buildDocxBlob(paragraphs), generateSingleFilename('.docx'));
        break;
      }
      case 'powerpoint': {
        var slides = parseSlidesFromText(text);
        triggerDownload(await buildPptxBlob(slides), generateSingleFilename('.pptx'));
        break;
      }
      case 'excel': {
        if (typeof XLSX === 'undefined') { alert('SheetJS niet geladen.'); return; }
        var tableData = parseTableData(text);
        var wb2 = XLSX.utils.book_new();
        var ws2 = XLSX.utils.aoa_to_sheet(tableData);
        if (tableData[0]) {
          ws2['!cols'] = tableData[0].map(function(_, ci) {
            return { wch: Math.min(60, Math.max(10, Math.max.apply(null, tableData.map(function(row) { return String(row[ci] || '').length; })))) };
          });
        }
        XLSX.utils.book_append_sheet(wb2, ws2, 'Antwoord');
        var wbout2 = XLSX.write(wb2, { bookType: 'xlsx', type: 'array' });
        triggerDownload(new Blob([wbout2], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), generateSingleFilename('.xlsx'));
        break;
      }
      case 'pdf': {
        var plain = stripMarkdown(text);
        var body  = plain.split('\n').filter(function(l) { return l.trim(); }).map(function(l) { return '<p>' + l + '</p>'; }).join('');
        openPrintWindow('Claude - Antwoord', formatTimestamp(new Date().toISOString()), '<div class="msg msg--ai"><div class="msg-body">' + body + '</div></div>');
        break;
      }
      case 'html': {
        var htmlBody = '<div class="message message--ai">' +
          '<div class="message-header"><span class="role">Claude</span><span class="time">' + formatTimestamp(new Date().toISOString()) + '</span></div>' +
          '<div class="content">' + markdownToHtml(text) + '</div></div>';
        triggerDownload(new Blob([buildHtmlWrapper('Claude - Antwoord', formatTimestamp(new Date().toISOString()), htmlBody)], { type: 'text/html;charset=utf-8' }), generateSingleFilename('.html'));
        break;
      }
      case 'markdown': {
        triggerDownload(new Blob(['# Claude - Antwoord\n\n> ' + formatTimestamp(new Date().toISOString()) + '\n\n---\n\n' + text], { type: 'text/markdown;charset=utf-8' }), generateSingleFilename('.md'));
        break;
      }
      default: {
        triggerDownload(new Blob(['CLAUDE - ANTWOORD\n==================================================\n' + formatTimestamp(new Date().toISOString()) + '\n==================================================\n\n' + stripMarkdown(text)], { type: 'text/plain;charset=utf-8' }), generateSingleFilename('.txt'));
        break;
      }
    }
  }

  function parseTableData(text) {
    var clean = text.trim();
    try {
      var p = JSON.parse(clean);
      if (Array.isArray(p)) return p.map(function(r) { return Array.isArray(r) ? r : [String(r)]; });
    } catch(_) {}
    var m = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) { try { var p2 = JSON.parse(m[1].trim()); if (Array.isArray(p2)) return p2; } catch(_) {} }
    var lines = clean.split('\n').filter(function(l) { return l.trim(); });
    return lines.map(function(line) {
      var sep = line.includes('\t') ? '\t' : ',';
      return line.split(sep).map(function(c) { return c.trim().replace(/^"|"$/g, ''); });
    });
  }

  // ─── Gedeelde helpers ─────────────────────────────────────────

  function openPrintWindow(title, meta, bodyHtml) {
    var html = '<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>' + title + '</title>' +
      '<style>@page{margin:20mm;size:A4}body{font-family:"Segoe UI",sans-serif;font-size:11pt;color:#1a1a1a;line-height:1.6}' +
      'h1{font-size:18pt;margin-bottom:4pt}.meta{font-size:9pt;color:#666;margin-bottom:20pt;border-bottom:1pt solid #ddd;padding-bottom:8pt}' +
      '.msg{margin-bottom:14pt;border:1pt solid #ddd;border-radius:4pt;overflow:hidden;page-break-inside:avoid}' +
      '.msg-head{display:flex;justify-content:space-between;padding:6pt 10pt;background:#f0ede8;font-size:9pt}' +
      '.msg--ai .msg-head{background:#1a1a1a;color:#fff}.msg--ai .msg-head span{color:#999}' +
      '.msg-body{padding:10pt;font-size:10.5pt}.msg-body p{margin:0 0 6pt}.msg-body p:last-child{margin:0}' +
      '</style></head><body>' +
      '<h1>' + title + '</h1><div class="meta">' + meta + '</div>' + bodyHtml + '</body></html>';
    var win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Sta pop-ups toe om PDF te exporteren.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function() { win.print(); }, 600);
  }

  function buildHtmlWrapper(title, meta, bodyHtml) {
    return '<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>' + title + '</title>' +
      '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI",system-ui,sans-serif;background:#f8f7f5;color:#1a1a1a;line-height:1.7;padding:40px 20px}' +
      '.container{max-width:800px;margin:0 auto}header{border-bottom:2px solid #1a1a1a;padding-bottom:16px;margin-bottom:32px}' +
      'header h1{font-size:22px;font-weight:700}header .meta{font-size:13px;color:#666;margin-top:4px}' +
      '.message{margin-bottom:20px;border-radius:10px;overflow:hidden;border:1px solid #e0ddd8}' +
      '.message-header{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#f0ede8;border-bottom:1px solid #e0ddd8}' +
      '.message--ai .message-header{background:#1a1a1a;color:#f0f0f0}.role{font-weight:700;font-size:13px}.time{font-size:11px;color:#888;font-family:monospace}' +
      '.content{padding:16px;background:#fff;font-size:14px}.message--ai .content{background:#fafaf9}' +
      '.content p{margin-bottom:10px}.content p:last-child{margin-bottom:0}' +
      '.content h1,.content h2,.content h3{font-weight:700;margin:16px 0 8px}' +
      '.content ul,.content ol{padding-left:20px;margin:8px 0}.content li{margin-bottom:4px}' +
      '.content code{background:#f0ede8;padding:2px 6px;border-radius:4px;font-family:monospace}' +
      'footer{margin-top:40px;text-align:center;font-size:12px;color:#999;border-top:1px solid #e0ddd8;padding-top:16px}' +
      '</style></head><body>' +
      '<div class="container"><header><h1>' + title + '</h1><div class="meta">' + meta + '</div></header>' +
      bodyHtml +
      '<footer>Gegenereerd via Claude AI Persoonlijke Interface</footer></div></body></html>';
  }

  // ─── Publieke API ──────────────────────────────────────────────

  async function exportChat(messages, format) {
    if (!messages || messages.length === 0) { alert('Er zijn geen berichten om te exporteren.'); return; }
    switch (format) {
      case 'markdown':    exportMarkdown(messages);          break;
      case 'txt':         exportTxt(messages);               break;
      case 'html':        exportHtml(messages);              break;
      case 'json':        exportJson(messages);              break;
      case 'csv':         exportCsv(messages);               break;
      case 'pdf':         exportPdf(messages);               break;
      case 'excel':       exportExcel(messages);             break;
      case 'powerpoint':  await exportPowerPoint(messages);  break;
      case 'docx':        await exportDocx(messages);        break;
      default:            exportMarkdown(messages);
    }
  }

  return { exportChat, exportSingleMessage };

})();

