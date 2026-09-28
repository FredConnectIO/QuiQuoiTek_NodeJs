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
      return `<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8" />\n   <title>${encodeText('courrier')}</title>\n  <style>\n   p { margin: 0; line-height: 1.8; font-family: Arial; font-size: 22px; text-indent: 0.5cm; }\n    h1, h2, h3, h4, h5, h6 { margin: 0em 0 0em 0; }\n    ul, ol, blockquote { margin: 0.25em 0; }\n  </style>\n</head>\n<body>\n${innerHtml}\n</body>\n</html>`;
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

    document.getElementById('btnClear').addEventListener('click', () => {
      structuredInput.value = '';
      htmlInput.value = '';
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


	function copyHtmlCode() {
		if (htmlInput) {
			htmlInput.select();
			document.execCommand('copy');
			alert('Code HTML copié dans le presse-papiers !');
		} else {
			alert('Aucun code HTML trouvé à copier.');
		}
	}
  
})();
