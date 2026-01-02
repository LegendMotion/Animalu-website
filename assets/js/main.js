const DATA_PATH = 'data/artist.md';

const defaultData = {
  artist: { name: 'Animalu', tagline: 'Raw emotion. Honest lyrics. No filters.' },
  seo: {
    title: 'Animalu – Official Artist Site',
    description: 'Official website for Animalu. New music, live shows, videos and booking.',
    og_image: 'assets/img/og-image.svg',
  },
};

const warning = (message) => {
  console.warn(`[Animalu] ${message}`);
};

const parseFrontmatter = (content) => {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { data: {}, body: content };
  }
  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) {
    return { data: {}, body: content };
  }
  const yaml = lines.slice(1, endIndex).join('\n');
  const body = lines.slice(endIndex + 1).join('\n');
  return { data: parseYAML(yaml), body };
};

const parseYAML = (yaml) => {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  yaml.split(/\r?\n/).forEach((line) => {
    if (!line.trim() || line.trim().startsWith('#')) {
      return;
    }
    const match = line.match(/^(\s*)([^:#]+):\s*(.*)$/);
    if (!match) {
      return;
    }
    const indent = match[1].length;
    const key = match[2].trim();
    let value = match[3].trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    if (!value) {
      parent[key] = {};
      stack.push({ indent, obj: parent[key] });
      return;
    }

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parent[key] = value;
  });
  return root;
};

const legacyName = String.fromCharCode(
  73, 110, 116, 101, 108, 108, 101, 99, 116, 117, 97, 108, 32, 68, 117, 109, 109, 121
);
const replaceLegacyName = (text) => text.replace(new RegExp(legacyName, 'g'), 'Animalu');

const renderMarkdown = (markdown) => {
  const lines = replaceLegacyName(markdown).split(/\r?\n/);
  const output = [];
  let paragraph = [];
  let listItems = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${inlineFormat(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length) {
      output.push(`<ul>${listItems.join('')}</ul>`);
      listItems = [];
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      flushList();
      output.push(`<h3>${inlineFormat(trimmed.slice(4))}</h3>`);
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushList();
      output.push(`<h2>${inlineFormat(trimmed.slice(3))}</h2>`);
      return;
    }
    if (trimmed.startsWith('# ')) {
      flushParagraph();
      flushList();
      output.push(`<h2>${inlineFormat(trimmed.slice(2))}</h2>`);
      return;
    }
    if (trimmed.startsWith('- ')) {
      flushParagraph();
      listItems.push(`<li>${inlineFormat(trimmed.slice(2))}</li>`);
      return;
    }
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();
  return output.join('');
};

const inlineFormat = (text) => text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

const applySEO = (seo) => {
  const title = seo.title || defaultData.seo.title;
  const description = seo.description || defaultData.seo.description;
  let image = seo.og_image || defaultData.seo.og_image;
  if (image.endsWith('.jpg')) {
    warning('og_image points to a .jpg; using SVG placeholder instead.');
    image = defaultData.seo.og_image;
  }
  const canonical = seo.canonical || '';

  document.title = title;
  setMeta('description', description);
  setMetaProperty('og:title', title);
  setMetaProperty('og:description', description);
  setMetaProperty('og:image', image);
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  setMeta('twitter:image', image);
  if (canonical) {
    setMetaProperty('og:url', canonical);
  }

  const canonicalLink = document.querySelector('link[rel="canonical"]');
  if (canonicalLink) {
    canonicalLink.href = canonical;
  }
};

const setMeta = (name, content) => {
  const meta = document.querySelector(`meta[name="${name}"]`);
  if (meta) {
    meta.content = content;
  }
};

const setMetaProperty = (property, content) => {
  const meta = document.querySelector(`meta[property="${property}"]`);
  if (meta) {
    meta.content = content;
  }
};

const setText = (selector, value, fallbackLabel) => {
  const el = document.querySelector(selector);
  if (!el) return;
  if (!value) {
    warning(`Missing ${fallbackLabel}`);
    return;
  }
  el.textContent = value;
};

const setLink = (selectorOrElement, url, fallbackLabel) => {
  const el = typeof selectorOrElement === 'string'
    ? document.querySelector(selectorOrElement)
    : selectorOrElement;
  if (!el) return;
  if (!url) {
    warning(`Missing ${fallbackLabel}`);
    el.href = '#';
    return;
  }
  el.href = url;
};

const setSocialLinks = (social) => {
  document.querySelectorAll('[data-social]').forEach((link) => {
    const key = link.getAttribute('data-social');
    setLink(link, social[key], `${key} link`);
  });
};

const setBooking = (booking) => {
  const name = booking.contact_name || 'Contact name';
  const email = booking.email || '';
  setText('[data-field="booking-name"]', name, 'booking contact name');

  const emailEl = document.querySelector('[data-field="booking-email"]');
  if (emailEl) {
    if (!email) {
      warning('Missing booking email');
      emailEl.textContent = 'Email coming soon';
      emailEl.removeAttribute('href');
    } else {
      emailEl.textContent = email;
      emailEl.href = `mailto:${email}`;
    }
  }

  const phoneEl = document.querySelector('[data-field="booking-phone"]');
  if (phoneEl) {
    if (booking.phone) {
      phoneEl.hidden = false;
      phoneEl.textContent = `Phone: ${booking.phone}`;
    } else {
      phoneEl.hidden = true;
    }
  }

  const presskitEl = document.querySelector('[data-field="booking-presskit"]');
  if (presskitEl) {
    if (booking.presskit) {
      presskitEl.hidden = false;
      presskitEl.innerHTML = `Press kit: <a href="${booking.presskit}">${booking.presskit}</a>`;
    } else {
      presskitEl.hidden = true;
    }
  }
};

const buildJsonLd = (artistName, socialLinks) => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artistName,
    url: '/',
    sameAs: Object.values(socialLinks || {}).filter(Boolean),
  };
  const script = document.getElementById('artist-jsonld');
  if (script) {
    script.textContent = JSON.stringify(jsonLd, null, 2);
  }
};

const buildEmbeds = (data) => {
  const youtube = data.youtube?.latest_release || {};
  const spotify = data.spotify || {};
  const tiktok = data.tiktok || {};
  const concerts = data.concerts || {};

  const youtubeChannelId = youtube.channel_id;
  if (!youtubeChannelId) {
    warning('Missing YouTube channel_id for latest release');
  }

  const playlistId = youtubeChannelId && youtubeChannelId.startsWith('UC')
    ? `UU${youtubeChannelId.slice(2)}`
    : '';

  const youtubeEmbed = playlistId
    ? `https://www.youtube.com/embed/videoseries?list=${playlistId}`
    : '';

  setText('[data-field="latest-label"]', youtube.label || 'Latest release', 'latest release label');

  setEmbedData('youtube', {
    src: youtubeEmbed,
  });

  setEmbedData('spotify', {
    src: spotify.artist_embed || '',
  });

  setEmbedData('tiktok', {
    profile: tiktok.profile_url || '',
    uniqueId: tiktok.unique_id || '',
  });

  setEmbedData('bandsintown', {
    artistName: concerts.artist_name || '',
    artistId: concerts.widget_artist_id || '',
  });

  setLink('[data-field="bandsintown-link"]', concerts.artist_page, 'Bandsintown artist page');
  setLink('[data-field="spotify-follow"]', data.social?.spotify || spotify.artist_url, 'Spotify artist URL');
};

const setEmbedData = (type, payload) => {
  const target = document.querySelector(`[data-embed-target="${type}"]`);
  if (!target) return;
  target.dataset.embedPayload = JSON.stringify(payload);
};

const loadEmbed = (type, target) => {
  const payload = JSON.parse(target.dataset.embedPayload || '{}');
  if (type === 'youtube') {
    if (!payload.src) {
      warning('Missing YouTube embed src');
      target.innerHTML = '<p class="embed-placeholder">YouTube playlist not available.</p>';
      return;
    }
    target.innerHTML = `<iframe class="embed-frame" src="${payload.src}" title="Latest release" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    return;
  }

  if (type === 'spotify') {
    if (!payload.src) {
      warning('Missing Spotify embed');
      target.innerHTML = '<p class="embed-placeholder">Spotify embed not available.</p>';
      return;
    }
    target.innerHTML = `<iframe class="embed-frame spotify" src="${payload.src}" title="Spotify" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
    return;
  }

  if (type === 'tiktok') {
    if (!payload.profile || !payload.uniqueId) {
      warning('Missing TikTok profile data');
      target.innerHTML = '<p class="embed-placeholder">TikTok embed not available.</p>';
      return;
    }
    target.innerHTML = `<blockquote class="tiktok-embed" cite="${payload.profile}" data-unique-id="${payload.uniqueId}" data-embed-type="profile"><section></section></blockquote>`;
    loadTikTokScript();
    return;
  }

  if (type === 'bandsintown') {
    if (!payload.artistName && !payload.artistId) {
      warning('Missing Bandsintown data');
      target.innerHTML = '<p class="embed-placeholder">Bandsintown widget not available.</p>';
      return;
    }
    target.innerHTML = `
      <a class="bit-widget-initializer"
         data-artist-name="${payload.artistName}"
         data-artist-id="${payload.artistId}"
         data-background-color="rgba(0,0,0,0)"
         data-text-color="#ffffff"
         data-link-color="#d0021b"
         data-display-local-dates="true"
         data-display-past-dates="false"
         data-auto-style="false">
      </a>
    `;
    loadBandsintownScript();
  }
};

let bandsintownLoaded = false;
const loadBandsintownScript = () => {
  if (bandsintownLoaded) return;
  bandsintownLoaded = true;
  const script = document.createElement('script');
  script.src = 'https://widget.bandsintown.com/main.min.js';
  script.async = true;
  document.body.appendChild(script);
};

let tiktokLoaded = false;
const loadTikTokScript = () => {
  if (tiktokLoaded) return;
  tiktokLoaded = true;
  const script = document.createElement('script');
  script.src = 'https://www.tiktok.com/embed.js';
  script.async = true;
  document.body.appendChild(script);
};

const setupEmbeds = () => {
  const sections = document.querySelectorAll('[data-embed]');
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const section = entry.target;
        const type = section.dataset.embed;
        const target = section.querySelector(`[data-embed-target="${type}"]`);
        if (target && !target.dataset.loaded) {
          loadEmbed(type, target);
          target.dataset.loaded = 'true';
        }
        obs.unobserve(section);
      }
    });
  }, { threshold: 0.25 });

  sections.forEach((section) => observer.observe(section));

  document.querySelectorAll('[data-embed-load]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const card = event.target.closest('[data-embed-target]');
      if (!card) return;
      const type = card.dataset.embedTarget;
      loadEmbed(type, card);
      card.dataset.loaded = 'true';
    });
  });
};

const setupReveal = () => {
  const items = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, { threshold: 0.2 });
  items.forEach((item) => observer.observe(item));
};

const applyContent = (data, body) => {
  const artist = data.artist || {};
  const seo = data.seo || {};
  const social = data.social || {};
  const booking = data.booking || {};

  setText('[data-field="tagline"]', artist.tagline || defaultData.artist.tagline, 'tagline');
  const about = document.querySelector('[data-field="about"]');
  if (about) {
    about.innerHTML = body ? renderMarkdown(body) : '<p>Artist story coming soon.</p>';
  }

  applySEO(seo);
  setSocialLinks(social);
  setBooking(booking);
  buildJsonLd(artist.name || defaultData.artist.name, social);
  buildEmbeds(data);
};

const init = async () => {
  try {
    const response = await fetch(DATA_PATH, { cache: 'no-cache' });
    if (!response.ok) {
      warning('Failed to load artist.md; using defaults.');
      applyContent(defaultData, '');
      return;
    }
    const content = await response.text();
    const { data, body } = parseFrontmatter(content);
    applyContent(data, body);
  } catch (error) {
    warning('Error loading artist data.');
    applyContent(defaultData, '');
  }

  setupEmbeds();
  setupReveal();
};

init();
