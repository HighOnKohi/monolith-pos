async function check() {
  const res = await fetch('https://monolith-pos.vercel.app/assets/index-Dnby0-JJ.js');
  const text = await res.text();
  const first = text.indexOf('min-h-screen');
  const idx = text.indexOf('min-h-screen', first + 1);
  console.log(text.slice(idx - 100, idx + 400));
}
check();
