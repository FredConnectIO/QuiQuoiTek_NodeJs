(() => {
  const requestedShift = window.prompt('Décalage alphabétique à appliquer :', '');
  const parsedShift = requestedShift !== null && requestedShift.trim() !== ''
    ? Number(requestedShift)
    : NaN;
  const shift = Number.isInteger(parsedShift) ? ((parsedShift % 26) + 26) % 26 : 4;

  const shiftLetter = (char) => {
    const code = char.charCodeAt(0);

    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift) % 26) + 65);
    }

    if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift) % 26) + 97);
    }

    return char;
  };

  const decodeText = (text) => text.replace(/[A-Za-z]/g, shiftLetter);
  const selector = 'title, p, h1, h2, h3, h4, h5, h6, li, blockquote';
  const walker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const parent = node.parentElement;

    if (parent && parent.matches(selector)) {
      textNodes.push(node);
    }
  }

  textNodes.forEach((node) => {
    node.nodeValue = decodeText(node.nodeValue);
  });
})();
