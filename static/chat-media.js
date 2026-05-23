const GIPHY_API_KEY = 'u8JVjqUKx81v8IODen6mNhLT5YS1MhwD';
const pickerPanel = document.getElementById('picker-panel');

// ────────────────────── Emoji Picker Setup ────────────────────
export function initEmojiPicker() {
    const emojiContainer = document.getElementById('tab-emoji');
    const picker = new EmojiMart.Picker({
    onEmojiSelect: (emoji) => {
        const input = document.getElementById('message-input');
        const pos = input.selectionStart;
        const before = input.value.substring(0, pos);
        const after = input.value.substring(pos);
        input.value = before + emoji.native + after;
        input.focus();
        input.selectionStart = input.selectionEnd = pos + emoji.native.length;
    }
});
emojiContainer.appendChild(picker);
}

// ────────────────────── GIF Loader ────────────────────
export async function loadGifs(query, onMediaSelect) {
    const endpoint = query === 'trending'
    ? `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=12`
    : `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&api_key=${GIPHY_API_KEY}&limit=12`;

    try {
        const res = await fetch(endpoint);
        const data = await res.json();
        const resultsDiv = document.getElementById('gif-results');
        resultsDiv.innerHTML = '';

        data.data.forEach(gif => {
            const url =gif.images.fixed_height_small.url;
            const img = document.createElement('img');
            img.src = url;
            img.className = 'gif-thumbnail';
            img.onclick = () => onMediaSelect(url, 'image');
            resultsDiv.appendChild(img);
        });
    } catch (err) {
        console.error("GIF load failed:", err);
        document.getElementById('gif-results').innerHTML = '<p style="padding:10px;color:#999;font-size:13px;">Add your GIPHY API key to enable GIFs</p>';
    }
}

// ────────────────────── Sticker Loader ────────────────────
export async function loadStickers(query = '', onMediaSelect) {
    const resultsDiv = document.getElementById('sticker-results');
    if (resultsDiv.dataset.loaded === 'true' && !query) return;
    resultsDiv.innerHTML = '<p style="padding:10px;color:#999;font-size:13px;">Loading...</p>';

    const endpoint = query
        ? `https://api.giphy.com/v1/stickers/search?q=${encodeURIComponent(query)}&api_key=${GIPHY_API_KEY}&limit=12`
        : `https://api.giphy.com/v1/stickers/trending?api_key=${GIPHY_API_KEY}&limit=12`;

    try {
        const res = await fetch(endpoint);
        const data = await res.json();
        resultsDiv.innerHTML = '';
        resultsDiv.dataset.loaded = 'true';

        data.data.forEach(sticker => {
            const url = sticker.images.fixed_height_small.url;
            const img = document.createElement('img');
            img.src = url;
            img.className = 'sticker-thumbnail';
            img.onclick = () => onMediaSelect(url, 'image');
            resultsDiv.appendChild(img);
        });
    } catch (err) {
        console.error("Sticker load failed:", err);
    }
}