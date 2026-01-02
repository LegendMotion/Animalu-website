/* Animalu static site – content is driven by /data/artist.md only.
   - Parses YAML frontmatter
   - Renders markdown body
   - Fetches YouTube RSS for latest release (music-only)
   - Lazy-loads Spotify, TikTok, Bandsintown embeds
   - Replaces forbidden string "Intellectual Dummy" => "Animalu"
*/

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const warnMissing = (path) => console.warn(`[artist.md] Missing field: ${path}`);

  // Very small YAML parser for the subset used in artist.md (nested objects, strings, booleans, empty strings).
  function parseYaml(yamlText) {
    const lines = yamlText.replace(/\t/g, '  ').split('\n');
    const root = {};
    const stack = [{ indent: -1, obj: root }];

    function setValue(parent, key, rawVal) {
      let val = rawVal;
      if (val === undefined) val = '';
      val = val.trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (val === 'true') val = true;
      if (val === 'false') val = false;
      parent[key] = val;
    }

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) continue;

      const indent = line.match(/^\s*/)[0].length;
      line = line.trimEnd();

      const m = line.trim().match(/^([^:]+):\s*(.*)$/);
      if (!m) continue;

      const key = m[1].trim();
      const rest = m[2];

      while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop();
      const parent = stack[stack.length - 1].obj;

      if (rest === '' || rest === null) {
        // nested object
        parent[key] = {};
        stack.push({ indent, obj: parent[key] });
      } else {
        setValue(parent, key, rest);
      }
    }
    return root;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // Minimal markdown renderer (headings, paragraphs, bold, italic, links, unordered lists).
  function renderMarkdown(md) {
    if (!md) return '';
    md = md.replaceAll('Intellectual Dummy', 'Animalu');

    const lines = md.replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let inList = false;

    const flushList = () => {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
    };

    for (let line of lines) {
      const t = line.trim();
      if (!t) {
        flushList();
        continue;
      }

      // Headings
      const h2 = t.match(/^##\s+(.*)$/);
      const h3 = t.match(/^###\s+(.*)$/);
      if (h2) {
        flushList();
        html += `<h2>${inlineMd(h2[1])}</h2>`;
        continue;
      }
      if (h3) {
        flushList();
        html += `<h3>${inlineMd(h3[1])}</h3>`;
        continue;
      }

      // List item
      const li = t.match(/^-+\s+(.*)$/);
      if (li) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        html += `<li>${inlineMd(li[1])}</li>`;
        continue;
      }

      // Paragraph
      flushList();
      html += `<p>${inlineMd(t)}</p>`;
    }

    flushList();
    return html;

    function inlineMd(text) {
      let s = escapeHtml(text);

      // links [text](url)
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) => {
        const safeUrl = url.replace(/"/g, '%22');
        return `<a href="${safeUrl}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
      });

      // bold **text**
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // italic *text* (simple)
      s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');

      return s;
    }
  }

  function splitFrontmatter(text) {
    const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!m) return { yaml: '', body: text };
    return { yaml: m[1], body: m[2] };
  }

  function get(obj, path) {
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
      if (!cur || typeof cur !== 'object' || !(p in cur)) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function setMeta(name, content) {
    const el = document.querySelector(`meta[name="${name}"]`);
    if (el) el.setAttribute('content', content);
  }
  function setOg(prop, content) {
    const el = document.querySelector(`meta[property="${prop}"]`);
    if (el) el.setAttribute('content', content);
  }

  function ensureAbsoluteOrEmptyCanonical(canonical) {
    // User requirement: no hardcoded domain. canonical may be empty (recommended for GH Pages without custom domain).
    const link = document.querySelector('link[rel="canonical"]');
    if (!link) return;
    link.setAttribute('href', canonical || '');
  }

  // Intersection Observer helpers
  function observeOnce(el, cb, rootMargin = '120px') {
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          io.disconnect();
          cb();
          return;
        }
      }
    }, { root: null, rootMargin, threshold: 0.01 });
    io.observe(el);
  }

  // Reveal animation
  function setupReveal() {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.classList.add('is-visible');
      }
    }, { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    els.forEach(el => io.observe(el));
  }

  function buildJsonLd(data) {
    const name = get(data, 'artist.name') || 'Animalu';
    const desc = get(data, 'seo.description') || '';
    const sameAs = [];
    const social = get(data, 'social') || {};
    for (const k of ['spotify','tiktok','instagram','facebook','youtube']) {
      if (social[k]) sameAs.push(social[k]);
    }

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "MusicGroup",
      "name": name,
      "description": desc,
      "sameAs": sameAs
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }

  async function loadArtist() {
    const res = await fetch('data/artist.md', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch /data/artist.md (${res.status})`);
    const text = await res.text();
    const fm = splitFrontmatter(text);
    const data = parseYaml(fm.yaml);
    const bodyHtml = renderMarkdown(fm.body);

    // Basic fields
    const name = get(data, 'artist.name') || (warnMissing('artist.name'), 'Animalu');
    const tagline = get(data, 'artist.tagline') || (warnMissing('artist.tagline'), 'No tagline set.');
    $('#artistName').textContent = name;
    $('#navName').textContent = name;
    $('#footerName').textContent = name;
    $('#footerName2').textContent = name;
    $('#artistTagline').textContent = tagline;

    $('#about').innerHTML = bodyHtml;

    // SEO meta from artist.md
    const title = get(data, 'seo.title') || (warnMissing('seo.title'), name);
    const description = get(data, 'seo.description') || (warnMissing('seo.description'), '');
    const ogImage = get(data, 'seo.og_image') || 'assets/img/og-image.jpg';
    document.title = title;
    setMeta('description', description);
    setOg('og:title', title);
    setOg('og:description', description);
    setOg('og:image', ogImage);
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', ogImage);
    ensureAbsoluteOrEmptyCanonical(get(data, 'seo.canonical') || '');

    // Social links (footer icons)
    const social = get(data, 'social') || {};
    linkOrWarn('#iconSpotify', social.spotify, 'social.spotify');
    linkOrWarn('#iconTikTok', social.tiktok, 'social.tiktok');
    linkOrWarn('#iconInstagram', social.instagram, 'social.instagram');
    linkOrWarn('#iconFacebook', social.facebook, 'social.facebook');
    linkOrWarn('#iconYouTube', social.youtube, 'social.youtube');

    // Spotify section
    const spotifyEmbed = get(data, 'spotify.artist_embed');
    const spotifyUrl = get(data, 'spotify.artist_url') || social.spotify;
    if (!spotifyEmbed) warnMissing('spotify.artist_embed');
    if (spotifyUrl) $('#spotifyFollow').href = spotifyUrl; else warnMissing('spotify.artist_url');

    // TikTok section
    const tiktokUrl = get(data, 'tiktok.profile_url') || social.tiktok;
    const tiktokUnique = get(data, 'tiktok.unique_id');
    if (tiktokUrl) $('#tiktokOpen').href = tiktokUrl; else warnMissing('tiktok.profile_url');
    if (!tiktokUnique) warnMissing('tiktok.unique_id');

    // Bandsintown
    const bitPage = get(data, 'concerts.artist_page');
    const bitArtistName = get(data, 'concerts.artist_name');
    const bitId = get(data, 'concerts.widget_artist_id');
    if (bitPage) $('#bitOpen').href = bitPage; else warnMissing('concerts.artist_page');
    if (!bitArtistName) warnMissing('concerts.artist_name');
    if (!bitId) warnMissing('concerts.widget_artist_id');

    // Booking
    $('#bookingName').textContent = get(data, 'booking.contact_name') || (warnMissing('booking.contact_name'), 'Booking');
    const email = get(data, 'booking.email');
    if (email) {
      $('#bookingEmail').textContent = email;
      $('#bookingEmail').href = `mailto:${email}`;
    } else {
      warnMissing('booking.email');
      $('#bookingEmail').textContent = 'Email not set';
      $('#bookingEmail').href = '#';
    }
    const phone = get(data, 'booking.phone');
    if (phone) {
      $('#bookingPhoneWrap').style.display = '';
      $('#bookingPhone').textContent = phone;
      $('#bookingPhone').href = `tel:${phone.replace(/\s+/g,'')}`;
    }
    const presskit = get(data, 'booking.presskit');
    if (presskit) {
      $('#bookingPresskitWrap').style.display = '';
      $('#bookingPresskit').href = presskit;
    }

    // Latest release config (music only)
    const ytChannelId = get(data, 'youtube.latest_release.channel_id');
    if (!ytChannelId) warnMissing('youtube.latest_release.channel_id');

    // JSON-LD
    buildJsonLd(data);

    // Lazy embeds
    setupLazyEmbeds({
      spotifyEmbed,
      tiktokUrl,
      tiktokUnique,
      bitArtistName,
      bitId,
      ytChannelId,
      social
    });
  }

  function linkOrWarn(sel, url, path) {
    const el = $(sel);
    if (!el) return;
    if (!url) {
      warnMissing(path);
      el.href = '#';
      el.style.opacity = '0.45';
      el.style.pointerEvents = 'none';
      return;
    }
    el.href = url;
  }

  function setupLazyEmbeds(ctx) {
    // YouTube latest release RSS + embed
    observeOnce($('#latest'), async () => {
      if (!ctx.ytChannelId) {
        $('#latestMeta').textContent = 'Channel ID missing.';
        return;
      }
      $('#latestMeta').textContent = 'Fetching from YouTube RSS…';
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(ctx.ytChannelId)}`;
      const rssFallbackUrl = `https://r.jina.ai/${rssUrl}`;

      try {
        const res = await fetch(rssUrl);
        if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
        const xmlText = await res.text();
        const xml = new DOMParser().parseFromString(xmlText, 'text/xml');

        const entry = xml.querySelector('feed > entry');
        if (!entry) throw new Error('No entries found.');

        const title = entry.querySelector('title')?.textContent?.trim() || 'Untitled';
        const published = entry.querySelector('published')?.textContent?.trim() || '';
        const videoId = entry.querySelector('yt\\:videoId, videoId')?.textContent?.trim()
          || extractVideoId(entry.querySelector('link')?.getAttribute('href') || '');

        $('#latestTitle').textContent = title;
        $('#latestDate').textContent = published ? formatDate(published) : '—';
        $('#latestMeta').textContent = 'Newest track from the music channel';

        if (!videoId) throw new Error('Could not determine video ID.');

        // Lazy iframe creation
        const container = $('#latestEmbed');
        container.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.title = title;
        iframe.loading = 'lazy';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        iframe.allowFullscreen = true;
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}`;
        container.appendChild(iframe);

      } catch (err) {
        console.warn(err);
        $('#latestMeta').textContent = 'Could not load latest release.';
        $('#latestTitle').textContent = '—';
        $('#latestDate').textContent = '—';
        $('#latestEmbed').innerHTML = `<div class="notice">Could not fetch the YouTube RSS feed. You can still find music on the official channels.</div>`;
      }
    });

    // Spotify embed
    observeOnce($('#spotify'), () => {
      const wrap = $('#spotifyEmbed');
      if (!ctx.spotifyEmbed) {
        wrap.innerHTML = `<div class="notice">Spotify embed is not configured in artist.md.</div>`;
        return;
      }
      wrap.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.src = ctx.spotifyEmbed;
      iframe.loading = 'lazy';
      iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      iframe.title = 'Spotify Artist';
      wrap.appendChild(iframe);
    });

    // TikTok embed (load script only when in view)
    observeOnce($('#tiktok'), () => {
      const wrap = $('#tiktokEmbed');
      if (!ctx.tiktokUnique) {
        wrap.innerHTML = `<div class="notice">TikTok embed is not configured in artist.md (tiktok.unique_id).</div>`;
        return;
      }
      wrap.innerHTML = '';
      const block = document.createElement('blockquote');
      block.className = 'tiktok-embed';
      block.setAttribute('cite', ctx.tiktokUrl || '');
      block.setAttribute('data-unique-id', ctx.tiktokUnique);
      block.setAttribute('data-embed-type', 'creator');
      block.style.maxWidth = '100%';
      block.style.minWidth = '288px';
      const section = document.createElement('section');
      block.appendChild(section);
      wrap.appendChild(block);

      loadScriptOnce('https://www.tiktok.com/embed.js', 'tiktok-embed-js');
    });

    // Bandsintown widget
    observeOnce($('#shows'), () => {
      const wrap = $('#bitWidget');
      const bitPage = $('#bitOpen')?.href;

      if (!ctx.bitArtistName || !ctx.bitId) {
        wrap.innerHTML = `<div class="notice">Bandsintown widget is not configured in artist.md. <a href="${bitPage || '#'}" target="_blank" rel="noopener">Open Bandsintown</a></div>`;
        return;
      }

      wrap.innerHTML = '';
      const a = document.createElement('a');
      a.className = 'bit-widget-initializer';
      a.setAttribute('data-artist-name', ctx.bitArtistName);
      a.setAttribute('data-display-local-dates', 'true');
      a.setAttribute('data-display-past-dates', 'false');
      a.setAttribute('data-auto-style', 'true');
      a.setAttribute('data-text-color', '#f2f2f2');
      a.setAttribute('data-link-color', '#d0021b');
      a.setAttribute('data-background-color', 'rgba(0,0,0,0)');
      a.setAttribute('data-display-limit', '12');
      a.setAttribute('data-display-lineup', 'false');
      a.setAttribute('data-separator-color', 'rgba(255,255,255,0.10)');
      a.href = bitPage || '#';
      wrap.appendChild(a);

      loadScriptOnce('https://widget.bandsintown.com/main.min.js', 'bandsintown-widget-js');
      // If script is blocked, keep fallback notice visible via link above (already provided).
    });
  }

  function loadScriptOnce(src, id) {
    if (document.getElementById(id)) return;
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.async = true;
    document.body.appendChild(s);
  }

  function extractVideoId(url) {
    if (!url) return '';
    const m1 = url.match(/[?&]v=([^&]+)/);
    if (m1) return m1[1];
    const m2 = url.match(/\/watch\/?([^?]+)/);
    if (m2) return m2[1];
    const m3 = url.match(/youtu\.be\/([^?]+)/);
    if (m3) return m3[1];
    return '';
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {
      return iso;
    }
  }

  // Init
  $('#year').textContent = String(new Date().getFullYear());
  setupReveal();
  loadArtist().catch(err => {
    console.error(err);
    $('#latestMeta').textContent = 'Failed to load artist.md';
    const about = $('#about');
    if (about) about.innerHTML = `<div class="notice">Could not load <strong>/data/artist.md</strong>. Make sure the file exists and is readable.</div>`;
  });

})();
