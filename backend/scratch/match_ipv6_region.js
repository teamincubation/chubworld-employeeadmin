const ip = '2406:da18:e5c:b700:2c87:2c04:550f:4a2d';

fetch('https://ip-ranges.amazonaws.com/ip-ranges.json')
  .then(res => res.json())
  .then(data => {
    console.log('Searching for prefix match for', ip);
    
    // Find matching prefix
    for (const prefix of data.ipv6_prefixes) {
      const parts = prefix.ipv6_prefix.split('::/');
      const base = parts[0];
      if (ip.toLowerCase().startsWith(base.toLowerCase())) {
        console.log('🎉 DIRECT MATCH FOUND:', prefix);
        return;
      }
    }

    console.log('Trying to match first 4 hex segments...');
    const first4 = ip.split(':').slice(0, 4).join(':');
    for (const prefix of data.ipv6_prefixes) {
      if (prefix.ipv6_prefix.toLowerCase().startsWith(first4.toLowerCase())) {
        console.log('🎉 NEAR MATCH FOUND:', prefix);
        return;
      }
    }

    console.log('Trying first 3 segments...');
    const first3 = ip.split(':').slice(0, 3).join(':');
    for (const prefix of data.ipv6_prefixes) {
      if (prefix.ipv6_prefix.toLowerCase().startsWith(first3.toLowerCase())) {
        console.log('🎉 3-SEGMENT MATCH FOUND:', prefix);
        return;
      }
    }
    
    console.log('No match found.');
  })
  .catch(err => console.error(err));
