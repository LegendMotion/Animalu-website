(() => {
  const warn = (msg) => console.warn(`[Animalu] ${msg}`);

  const qs = (s, el=document) => el.querySelector(s);
  const qsa = (s, el=document) => Array.from(el.querySelectorAll(s));

  // --- Minimal YAML parser (supports nested objects via 2-space indent) ---
  function parseYAML(yamlText){
    const lines = yamlText.replace(/\t/g,'  ').split(/\r?\n/);
    const root = {};
    const stack = [{indent:-1, obj:root}];
    for (let raw of lines){
      if(!raw.trim() || raw.trim().startsWith('#')) continue;
      const indent = raw.match(/^ */)[0].length;
      const line = raw.trimEnd();
      const m = line.match(/^([^:]+):(?:\s*(.*))?$/);
      if(!m) continue;
      const key = m[1].trim().replace(/^"|"$/g,'');
      let val = (m[2] ?? '').trim();
      // pop stack to correct indent
      while(stack.length && indent <= stack[stack.length-1].indent) stack.pop();
      const parent = stack[stack.length-1].obj;
      if(val === '' ){
        parent[key] = {};
        stack.push({indent, obj: parent[key]});
      } else {
        // strip quotes
        val = val.replace(/^"(.*)"$/,'$1').replace(/^'(.*)'$/,'$1');
        // booleans/null
        if(val === 'true') val = true;
        else if(val === 'false') val = false;
        else if(val === 'null' || val === '~') val = null;
        parent[key] = val;
      }
    }
    return root;
  }

  // --- Very small markdown renderer (headings, lists, paragraphs, links, bold/italic) ---
  function mdToHtml(md){
    // sanitize basic
    md = md.replace(/\r/g,'');
    // critical replacement
    md = md.replace(/Intellectual Dummy/g, 'Animalu');

    const lines = md.split('\n');
    let html = '';
    let inList = false;

    const inline = (s) => s
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');

    for(const line of lines){
      const t = line.trim();
      if(!t){
        if(inList){ html += '</ul>'; inList=false; }
        continue;
      }
      const h3 = t.match(/^###\s+(.*)$/);
      const h2 = t.match(/^##\s+(.*)$/);
      const li = t.match(/^-\s+(.*)$/);
      if(h2){
        if(inList){ html += '</ul>'; inList=false; }
        html += `<h3>${inline(h2[1])}</h3>`;
        continue;
      }
      if(h3){
        if(inList){ html += '</ul>'; inList=false; }
        html += `<h3>${inline(h3[1])}</h3>`;
        continue;
      }
      if(li){
        if(!inList){ html += '<ul>'; inList=true; }
        html += `<li>${inline(li[1])}</li>`;
        continue;
      }
      if(inList){ html += '</ul>'; inList=false; }
      html += `<p>${inline(t)}</p>`;
    }
    if(inList) html += '</ul>';
    return html;
  }

  function parseFrontmatter(mdText){
    const fmMatch = mdText.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
    if(!fmMatch){
      warn('No YAML frontmatter found in artist.md');
      return {data:{}, body: mdText};
    }
    const yaml = fmMatch[1];
    let body = fmMatch[2] || '';
    // critical replacement before render
    body = body.replace(/Intellectual Dummy/g,'Animalu');
    const data = parseYAML(yaml);
    return {data, body};
  }

  function setMeta(name, content){
    if(!content) return;
    let el = document.querySelector(`meta[name="${name}"]`);
    if(!el){
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }
  function setProp(property, content){
    if(!content) return;
    let el = document.querySelector(`meta[property="${property}"]`);
    if(!el){
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  // Lazy iframe loader
  function createLazyIframe(src, title){
    const iframe = document.createElement('iframe');
    iframe.loading = 'lazy';
    iframe.src = src;
    iframe.title = title || '';
    iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    iframe.referrerPolicy = 'origin-when-cross-origin';
    return iframe;
  }

  // Scroll reveal
  function initReveal(){
    const els = qsa('.reveal');
    const io = new IntersectionObserver((entries)=>{
      for(const e of entries){
        if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
      }
    }, {threshold: 0.12});
    els.forEach(el=>io.observe(el));
  }

  // YouTube RSS fetching with proxy fallback
  async function fetchYouTubeLatest(channelId){
    const rss = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    const attempts = [
      {label:'direct', url:rss},
      {label:'jina', url:`https://r.jina.ai/http://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`},
      {label:'jina-https', url:`https://r.jina.ai/https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`},
      {label:'allorigins', url:`https://api.allorigins.win/raw?url=${encodeURIComponent(rss)}`},
    ];
    for(const a of attempts){
      try{
        const res = await fetch(a.url, {cache:'no-store'});
        if(!res.ok) throw new Error(`${a.label} status ${res.status}`);
        const text = await res.text();
        const xmlText = text.includes('<feed') ? text : text.replace(/^.*?<feed/s,'<feed'); // crude for proxies
        const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
        const entry = xml.querySelector('entry');
        if(!entry) throw new Error(`${a.label} no entry`);
        const videoId = entry.querySelector('yt\\:videoId, videoId')?.textContent?.trim();
        const title = entry.querySelector('title')?.textContent?.trim() || 'Latest release';
        const published = entry.querySelector('published')?.textContent?.trim();
        if(!videoId) throw new Error(`${a.label} no videoId`);
        return {videoId, title, published, via:a.label};
      } catch(err){
        warn(`YouTube RSS fetch failed (${a.label}): ${err.message}`);
      }
    }
    return null;
  }

  function formatDate(iso){
    if(!iso) return '';
    try{
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
    } catch { return iso; }
  }

  async function renderLatestRelease(cfg){
    const channelId = cfg?.youtube?.latest_release?.channel_id;
    const container = qs('#latestRelease');
    const titleEl = qs('#latestTitle');
    const dateEl = qs('#latestDate');

    if(!channelId){
      warn('youtube.latest_release.channel_id is missing');
      container.innerHTML = `<div class="notice">Latest release is not configured.</div>`;
      return;
    }

    // Try RSS first (spec requirement), with fallbacks
    const latest = await fetchYouTubeLatest(channelId);

    if(latest){
      // lazy iframe
      const ratio = document.createElement('div');
      ratio.className = 'ratio';
      const iframe = createLazyIframe(`https://www.youtube-nocookie.com/embed/${latest.videoId}`, 'Latest release');
      iframe.setAttribute('loading','lazy');
      ratio.appendChild(iframe);
      container.innerHTML = '';
      container.appendChild(ratio);
      titleEl.textContent = latest.title;
      dateEl.textContent = formatDate(latest.published);
      return;
    }

    // Final fallback: channel uploads playlist (still music-only topic channel)
    warn('Falling back to channel uploads playlist embed (RSS unavailable).');
    const ratio = document.createElement('div');
    ratio.className = 'ratio';
    // Uploads playlist is UU + channelId without UC
    const list = `UU${channelId.replace(/^UC/,'')}`;
    const iframe = createLazyIframe(`https://www.youtube-nocookie.com/embed?listType=playlist&list=${encodeURIComponent(list)}`, 'Latest release');
    ratio.appendChild(iframe);
    container.innerHTML = '';
    container.appendChild(ratio);
    titleEl.textContent = cfg?.youtube?.latest_release?.label || 'Latest release';
    dateEl.textContent = '';
  }

  function renderSpotify(cfg){
    const embed = cfg?.spotify?.artist_embed;
    const url = cfg?.spotify?.artist_url || cfg?.social?.spotify;
    const target = qs('#spotifyEmbed');

    if(embed){
      const ratio = document.createElement('div');
      ratio.className='ratio';
      ratio.style.aspectRatio = '16/6';
      const iframe = createLazyIframe(embed, 'Spotify artist');
      iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      ratio.appendChild(iframe);
      target.innerHTML='';
      target.appendChild(ratio);
    } else {
      warn('spotify.artist_embed is missing');
      target.innerHTML = `<div class="notice">Spotify embed is not configured.</div>`;
    }

    const follow = qs('#spotifyFollow');
    if(url){
      follow.href = url;
    } else {
      warn('spotify artist url is missing');
      follow.href = '#';
    }
  }

  function renderTikTok(cfg){
    const url = cfg?.tiktok?.profile_url || cfg?.social?.tiktok;
    const unique = cfg?.tiktok?.unique_id;
    const wrap = qs('#tiktokEmbed');

    if(!url || !unique){
      warn('tiktok.profile_url or tiktok.unique_id missing');
      wrap.innerHTML = `<div class="notice">TikTok is not configured.</div>`;
      return;
    }

    // Create embed markup, load script only when visible
    wrap.innerHTML = `
      <blockquote class="tiktok-embed" cite="${url}" data-unique-id="${unique}" style="max-width: 780px; min-width: 300px;">
        <section></section>
      </blockquote>
      <div class="notice">If the embed doesn’t load, use the TikTok icon in the footer.</div>
    `;

    const section = qs('#tiktok');
    const io = new IntersectionObserver((entries)=>{
      for(const e of entries){
        if(!e.isIntersecting) continue;
        io.disconnect();
        // inject script once
        if(!qs('script[data-tiktok]')){
          const s = document.createElement('script');
          s.src = 'https://www.tiktok.com/embed.js';
          s.async = true;
          s.setAttribute('data-tiktok','1');
          document.body.appendChild(s);
        }
      }
    }, {threshold:0.15});
    io.observe(section);
  }

  function renderBandsintown(cfg){
    const id = cfg?.concerts?.widget_artist_id;
    const page = cfg?.concerts?.artist_page;
    const target = qs('#bitWrap');
    const link = qs('#bitFallback');

    if(page) link.href = page; else { link.href='#'; warn('concerts.artist_page missing'); }

    // Lazy load widget script + initializer when section visible
    const section = qs('#shows');
    const io = new IntersectionObserver((entries)=>{
      for(const e of entries){
        if(!e.isIntersecting) continue;
        io.disconnect();

        if(!id){
          warn('concerts.widget_artist_id missing');
          target.innerHTML = `<div class="notice">Live shows widget is not configured. Use the Bandsintown link.</div>`;
          return;
        }

        // Insert initializer anchor using style attributes from your dashboard snippet.
        const a = document.createElement('a');
        a.className = 'bit-widget-initializer';
        a.setAttribute('data-artist-name', id);
        a.setAttribute('data-events-to-display', '');
        a.setAttribute('data-background-color', 'rgba(97,86,86,0)');
        a.setAttribute('data-separator-color', 'rgba(255,99,99,1)');
        a.setAttribute('data-text-color', 'rgba(255,255,255,1)');
        a.setAttribute('data-font', 'Arial');
        a.setAttribute('data-auto-style', 'true');

        a.setAttribute('data-button-label-capitalization', 'capitalize');
        a.setAttribute('data-header-capitalization', 'uppercase');
        a.setAttribute('data-location-capitalization', 'capitalize');
        a.setAttribute('data-venue-capitalization', 'capitalize');
        a.setAttribute('data-display-local-dates', 'true');
        a.setAttribute('data-local-dates-position', 'tab');
        a.setAttribute('data-display-past-dates', 'true');
        a.setAttribute('data-display-details', 'false');
        a.setAttribute('data-display-lineup', 'false');
        a.setAttribute('data-display-start-time', 'false');
        a.setAttribute('data-social-share-icon', 'false');
        a.setAttribute('data-display-limit', 'all');

        a.setAttribute('data-date-format', 'MMM. D, YYYY');
        a.setAttribute('data-date-orientation', 'horizontal');
        a.setAttribute('data-date-border-color', '#4A4A4A');
        a.setAttribute('data-date-border-width', '1px');
        a.setAttribute('data-date-capitalization', 'capitalize');
        a.setAttribute('data-date-border-radius', '10px');

        a.setAttribute('data-event-ticket-cta-size', 'medium');
        a.setAttribute('data-event-custom-ticket-text', '');
        a.setAttribute('data-event-ticket-text', 'TICKETS');
        a.setAttribute('data-event-ticket-icon', 'false');
        a.setAttribute('data-event-ticket-cta-text-color', '#FFFFFF');
        a.setAttribute('data-event-ticket-cta-bg-color', 'rgba(208,2,27,1)');
        a.setAttribute('data-event-ticket-cta-border-color', 'rgba(208,2,27,1)');
        a.setAttribute('data-event-ticket-cta-border-width', '0px');
        a.setAttribute('data-event-ticket-cta-border-radius', '4px');

        a.setAttribute('data-sold-out-button-text-color', '#FFFFFF');
        a.setAttribute('data-sold-out-button-background-color', 'rgba(208,2,27,1)');
        a.setAttribute('data-sold-out-button-border-color', 'rgba(208,2,27,1)');
        a.setAttribute('data-sold-out-button-clickable', 'true');

        a.setAttribute('data-event-rsvp-position', 'left');
        a.setAttribute('data-event-rsvp-cta-size', 'medium');
        a.setAttribute('data-event-rsvp-only-show-icon', 'false');
        a.setAttribute('data-event-rsvp-text', 'REMIND ME');
        a.setAttribute('data-event-rsvp-icon', 'false');
        a.setAttribute('data-event-rsvp-cta-text-color', 'rgba(208,2,27,1)');
        a.setAttribute('data-event-rsvp-cta-bg-color', '#FFFFFF');
        a.setAttribute('data-event-rsvp-cta-border-color', 'rgba(208,2,27,1)');
        a.setAttribute('data-event-rsvp-cta-border-width', '1px');
        a.setAttribute('data-event-rsvp-cta-border-radius', '4px');

        a.setAttribute('data-follow-section-position', 'top');
        a.setAttribute('data-follow-section-alignment', 'center');
        a.setAttribute('data-follow-section-header-text', 'Get updates on new shows, new music, and more.');
        a.setAttribute('data-follow-section-cta-size', 'medium');
        a.setAttribute('data-follow-section-cta-text', 'FOLLOW');
        a.setAttribute('data-follow-section-cta-icon', 'true');
        a.setAttribute('data-follow-section-cta-text-color', '#FFFFFF');
        a.setAttribute('data-follow-section-cta-bg-color', 'rgba(208,2,27,1)');
        a.setAttribute('data-follow-section-cta-border-color', 'rgba(208,2,27,1)');
        a.setAttribute('data-follow-section-cta-border-width', '0px');
        a.setAttribute('data-follow-section-cta-border-radius', '4px');

        a.setAttribute('data-play-my-city-position', 'bottom');
        a.setAttribute('data-play-my-city-alignment', 'Center');
        a.setAttribute('data-play-my-city-header-text', 'Don’t see a show near you?');
        a.setAttribute('data-play-my-city-cta-size', 'medium');
        a.setAttribute('data-play-my-city-cta-text', 'REQUEST A SHOW');
        a.setAttribute('data-play-my-city-cta-icon', 'true');
        a.setAttribute('data-play-my-city-cta-text-color', '#FFFFFF');
        a.setAttribute('data-play-my-city-cta-bg-color', 'rgba(208,2,27,1)');
        a.setAttribute('data-play-my-city-cta-border-color', 'rgba(208,2,27,1)');
        a.setAttribute('data-play-my-city-cta-border-width', '0px');
        a.setAttribute('data-play-my-city-cta-border-radius', '4px');

        a.setAttribute('data-language', 'en');
        a.setAttribute('data-layout-breakpoint', '900');

        // Bandsintown widget requires an app id; allow override later via artist.md if added.
        const appId = cfg?.concerts?.app_id || 'a8edf27028eb2ed38a51403a80531a44';
        if(!cfg?.concerts?.app_id) warn('concerts.app_id missing in artist.md; using default widget app id.');
        a.setAttribute('data-app-id', appId);

        a.setAttribute('data-affil-code', '');
        a.setAttribute('data-bit-logo-position', 'hidden');
        a.setAttribute('data-bit-logo-color', 'rgba(255,255,255,1)');

        target.innerHTML = '';
        target.appendChild(a);

        // load script once
        if(!qs('script[data-bit]')){
          const s = document.createElement('script');
          s.charset = 'utf-8';
          s.src = 'https://widgetv3.bandsintown.com/main.min.js';
          s.async = true;
          s.setAttribute('data-bit','1');
          document.body.appendChild(s);
        }
      }
    }, {threshold:0.2});
    io.observe(section);
  }

  function setSocialIcons(cfg){
    const s = cfg?.social || {};
    const map = {
      spotify: s.spotify,
      tiktok: s.tiktok,
      instagram: s.instagram,
      facebook: s.facebook,
      youtube: s.youtube
    };
    for(const [k,v] of Object.entries(map)){
      const a = qs(`[data-social="${k}"]`);
      if(!a) continue;
      if(v){ a.href = v; a.style.display='inline-flex'; }
      else { a.href = '#'; a.style.display='none'; warn(`social.${k} missing`); }
    }
  }

  function setBooking(cfg){
    const b = cfg?.booking || {};
    const nameEl = qs('#bookingName');
    const emailEl = qs('#bookingEmail');
    const phoneEl = qs('#bookingPhone');
    const pressEl = qs('#bookingPresskit');

    nameEl.textContent = b.contact_name || 'Booking';
    if(!b.contact_name) warn('booking.contact_name missing');

    if(b.email){
      emailEl.textContent = b.email;
      emailEl.href = `mailto:${b.email}`;
    } else {
      warn('booking.email missing');
      emailEl.textContent = 'Email not set';
      emailEl.href = '#';
    }

    if(b.phone){
      phoneEl.textContent = b.phone;
      phoneEl.href = `tel:${b.phone.replace(/\s+/g,'')}`;
      phoneEl.closest('.row').style.display='flex';
    } else {
      phoneEl.closest('.row').style.display='none';
      warn('booking.phone missing');
    }

    if(b.presskit){
      pressEl.textContent = 'Presskit';
      pressEl.href = b.presskit;
      pressEl.closest('.row').style.display='flex';
    } else {
      pressEl.closest('.row').style.display='none';
      warn('booking.presskit missing');
    }
  }

  function setHero(cfg){
    const name = cfg?.artist?.name || 'Animalu';
    const tagline = cfg?.artist?.tagline || 'New music, live shows, videos and booking.';

    qs('#artistName').textContent = name;
    qs('#tagline').textContent = tagline;

    const seoTitle = cfg?.seo?.title || name;
    const seoDesc = cfg?.seo?.description || tagline;
    document.title = seoTitle;
    setMeta('description', seoDesc);

    // OG / Twitter
    setProp('og:title', seoTitle);
    setProp('og:description', seoDesc);
    setProp('og:type', 'website');
    setProp('og:image', cfg?.seo?.og_image || '/assets/img/og-image.jpg');
    setProp('og:url', (cfg?.seo?.canonical && cfg.seo.canonical.trim()) ? cfg.seo.canonical.trim() : window.location.href);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', seoTitle);
    setMeta('twitter:description', seoDesc);
    setMeta('twitter:image', cfg?.seo?.og_image || '/assets/img/og-image.jpg');

    // Accent color
    const primary = cfg?.theme?.primary_color;
    if(primary){
      document.documentElement.style.setProperty('--red', primary);
    } else {
      warn('theme.primary_color missing');
    }

    // JSON-LD
    const ld = {
      "@context":"https://schema.org",
      "@type":"MusicGroup",
      "name": name,
      "url": window.location.origin + window.location.pathname,
      "sameAs": Object.values(cfg?.social || {}).filter(Boolean),
      "genre": "Hip Hop",
      "description": seoDesc
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(ld);
    document.head.appendChild(script);
  }

  async function init(){
    initReveal();

    let mdText;
    try{
      const res = await fetch('/data/artist.md', {cache:'no-store'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      mdText = await res.text();
    } catch(err){
      warn(`Failed to load /data/artist.md: ${err.message}`);
      return;
    }

    const {data, body} = parseFrontmatter(mdText);
    setHero(data);
    setSocialIcons(data);
    await renderLatestRelease(data);
    renderSpotify(data);
    renderTikTok(data);
    renderBandsintown(data);
    setBooking(data);

    // Render markdown body into About inside booking card (keeps section order)
    const about = qs('#aboutBody');
    if(about){
      about.innerHTML = mdToHtml(body);
      about.classList.add('md');
    }

    // Update anchors text from cfg where relevant
    const label = data?.youtube?.latest_release?.label;
    if(label) qs('#latestLabel').textContent = label;

    // Graceful placeholders for missing
    const concertsProvider = data?.concerts?.provider || 'Live shows';
    qs('#showsSub').textContent = `Tour dates and tickets powered by ${concertsProvider}.`;
  }

  init();
})();
