(() => {

    const structuredInput = document.getElementById('structured');
    const htmlInput = document.getElementById('html');
    const rendered = document.getElementById('rendered');
    const requestedShift = window.prompt('Décalage alphabétique à appliquer :', '');
    const parsedShift = requestedShift !== null && requestedShift.trim() !== ''
      ? Number(requestedShift)
      : NaN;
    const shift = Number.isInteger(parsedShift) ? ((parsedShift % 26) + 26) % 26 : 4;

    const escapeHtml = (value) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const shiftLetterBack = (char) => {
      const code = char.charCodeAt(0);

      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 - shift + 26) % 26) + 65);
      }

      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 - shift + 26) % 26) + 97);
      }

      return char;
    };

    const encodeText = (text) => text.replace(/[A-Za-z]/g, shiftLetterBack);
    const decodeText = (text) => text.replace(/[A-Za-z]/g, (char) => {
      const code = char.charCodeAt(0);
      const start = code <= 90 ? 65 : 97;
      return String.fromCharCode(((code - start + shift) % 26) + start);
    });

    const encodeHtmlText = (html) => {
      const template = document.createElement('template');
      template.innerHTML = html;
      const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
      const textNodes = [];

      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }

      textNodes.forEach((node) => {
        node.nodeValue = encodeText(node.nodeValue);
      });

      return template.innerHTML;
    };

    const formatInline = (text) => {
      if (!text) return '';
      const formatted = text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[(.+?)\]\(([^\s)]+)\)/g, '<a href="$2">$1</a>');

      return encodeHtmlText(formatted);
    };

    const wrapFullHtml = (innerHtml) => {
      return `<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8" />\n   <title>${encodeText('courrier')}</title>\n  <style>\n   p { margin: 0; line-height: 1.8; font-family: Arial; font-size: 22px; text-indent: 0.5cm; }\n    h1, h2, h3, h4, h5, h6 { margin: 0em 0 0em 0; }\n    ul, ol, blockquote { margin: 0.25em 0; }\n  </style>\n</head>\n<body>\n${innerHtml}\n<script src="htmldecode.js"></script>\n</body>\n</html>`;
    };

    const structuredToHtml = (input) => {
      const lines = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      let output = '';
      let inList = false;
      let inBlockquote = false;
      lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) {
          if (inList) { output += '</ul>\n'; inList = false; }
          if (inBlockquote) { output += '</blockquote>\n'; inBlockquote = false; }
          return;
        }

        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
          if (inList) { output += '</ul>\n'; inList = false; }
          if (inBlockquote) { output += '</blockquote>\n'; inBlockquote = false; }
          const level = heading[1].length;

          output += `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 1em;">
            <tr>
              <td style="width: 80%; text-align: center; padding: 0.5em; border: 1px solid #ccc;">
                <h${level}>${formatInline(escapeHtml(heading[2]))}</h${level}>
              </td>
              <td style="width: 20%; text-align: center; padding: 0.5em; border: 1px solid #ccc;">
                <a href="index.html" style="display: inline-block;">
                  <img src="left-arrow.svg" alt="Retour" style="width: 32px; height: 32px;">
                </a>
              </td>
            </tr>
          </table>
          `;
          return;
        }

        if (line.startsWith('-')){
          output += `<hr style="border: 2px solid #000; width: 50%; margin: 20px auto;">\n`;
          return;
        }

        if (line.startsWith('> ')) {
          if (inList) { output += '</ul>\n'; inList = false; }
          if (!inBlockquote) { output += '<blockquote>\n'; inBlockquote = true; }
          output += `<p>${formatInline(escapeHtml(line.substring(2).trim()))}</p>\n`;
          return;
        }

        if (inList) { output += '</ul>\n'; inList = false; }
        if (inBlockquote) { output += '</blockquote>\n'; inBlockquote = false; }
        output += `<p>${formatInline(escapeHtml(line))}</p>\n`;
      });

      if (inList) { output += '</ul>\n'; }
      if (inBlockquote) { output += '</blockquote>\n'; }
      return wrapFullHtml(output.trim());
    };

    const refreshRender = () => {
      const sourceHtml = htmlInput.value || '';
      if (!sourceHtml.trim()) {
        rendered.innerHTML = '<em>Pas de contenu HTML</em>';
        return;
      }
      try {
        const doc = new DOMParser().parseFromString(sourceHtml, 'text/html');
        rendered.innerHTML = doc.body ? doc.body.innerHTML : sourceHtml;
      } catch (e) {
        rendered.innerHTML = sourceHtml;
      }
    };


    const htmlToStructured = (input) => {
      try {
        const doc = new DOMParser().parseFromString(input, 'text/html');
        const lines = [];

        const walk = (node) => {
          if (!node) return;
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.replace(/\s+/g, ' ').trim();
            if (text) lines.push(text);
            return;
          }

          if (node.nodeType !== Node.ELEMENT_NODE) return;

          switch (node.tagName.toLowerCase()) {
            case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
              const level = Number(node.tagName[1]);
              const text = node.textContent.trim();
              lines.push('#'.repeat(level) + ' ' + text);
              lines.push('');
              break;
            }
            case 'p':
              lines.push(node.textContent.trim());
              lines.push('');
              break;
            case 'ul':
              node.querySelectorAll(':scope > li').forEach((li) => {
                lines.push('- ' + li.textContent.trim());
              });
              lines.push('');
              break;
            case 'ol':
              let num = 1;
              node.querySelectorAll(':scope > li').forEach((li) => {
                lines.push(`${num++}. ${li.textContent.trim()}`);
              });
              lines.push('');
              break;
            case 'blockquote':
              node.querySelectorAll('p, div, span, br, text').forEach((child) => {}); // Do nothing
              lines.push('> ' + node.textContent.trim());
              lines.push('');
              break;
            case 'pre':
              lines.push('```');
              lines.push(node.textContent.trim());
              lines.push('```');
              lines.push('');
              break;
            default:
              Array.from(node.childNodes).forEach(walk);
              break;
          }
        };

        Array.from(doc.body.childNodes).forEach(walk);
        // Remove trailing blank lines
        while (lines.length && lines[lines.length - 1] === '') {
          lines.pop();
        }
        return lines.join('\n');
      } catch (e) {
        console.error('Erreur htmlToStructured', e);
        return '';
      }
    };






    document.getElementById('btnClear').addEventListener('click', () => {
      structuredInput.value = '';
      htmlInput.value = '';
      refreshRender();
    });

    document.getElementById('btnToStruct').addEventListener('click', () => {
      const structured = htmlToStructured(htmlInput.value);
      structuredInput.value = decodeText(structured);
      refreshRender();
    });

    structuredInput.addEventListener('input', () => {
      // Keep preview in sync with structured input conversion as user types.
      try {
        const previewHtml = structuredToHtml(structuredInput.value);
        htmlInput.value = previewHtml;
        refreshRender();
      } catch {
        // ignore errors on typing
      }
    });

    htmlInput.addEventListener('input', () => {
      refreshRender();
    });

    refreshRender();


    document.getElementById('btnCopyHtml').addEventListener('click', () => {
      htmlInput.select();
      if (document.execCommand('copy')) {
        alert('Code HTML copié dans le presse-papiers !');
      } else {
        alert('Impossible de copier le code HTML.');
      }
    });
  
})();
