const dns = require('dns');

dns.resolve6('db.mcolsszozjnveoommnuk.supabase.co', (err, addresses) => {
  if (err) {
    console.error('DNS resolve failed:', err);
    return;
  }
  const ip = addresses[0];
  console.log('IPv6 address resolved:', ip);
  
  fetch('https://ip-ranges.amazonaws.com/ip-ranges.json')
    .then(res => res.json())
    .then(data => {
      // Find matching prefix
      for (const prefix of data.ipv6_prefixes) {
        const parts = prefix.ipv6_prefix.split('::/');
        const base = parts[0];
        if (ip.toLowerCase().startsWith(base.toLowerCase())) {
          console.log('🎉 MATCH FOUND:', prefix);
          return;
        }
      }
      console.log('No direct base match. Trying to match first 4 hex segments...');
      const first4 = ip.split(':').slice(0, 4).join(':');
      for (const prefix of data.ipv6_prefixes) {
        if (prefix.ipv6_prefix.toLowerCase().startsWith(first4.toLowerCase())) {
          console.log('🎉 NEAR MATCH FOUND:', prefix);
          return;
        }
      }
      console.log('No match found.');
    })
    .catch(fetchErr => console.error('Fetch error:', fetchErr));
});
