
document.addEventListener('DOMContentLoaded',()=>{
  const yt = document.querySelector('[data-youtube-channel]');
  if(yt){
    const cid = yt.dataset.youtubeChannel;
    const iframe = document.createElement('iframe');
    iframe.loading = 'lazy';
    iframe.height = '315';
    iframe.src = `https://www.youtube.com/embed?listType=playlist&list=UU${cid.replace(/^UC/,'')}`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    yt.appendChild(iframe);
  }
});
