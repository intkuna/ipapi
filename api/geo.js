import maxmind from "maxmind";
import path from "path";

const cityDB = await maxmind.open(path.join(process.cwd(), "db/GeoLite2-City.mmdb"));
const asnDB = await maxmind.open(path.join(process.cwd(), "db/GeoLite2-ASN.mmdb"));

function extractIP(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
}

function isVPN(asnData) {
  if (!asnData) return false;
  const vpnKeywords = ["VPN", "Proxy", "Hosting", "DigitalOcean", "AWS", "OVH", "Hetzner"];
  return vpnKeywords.some(k => asnData.autonomous_system_organization?.toLowerCase().includes(k.toLowerCase()));
}

function getCountryFlag(isoCode) {
  if (!isoCode) return null;
  const codePoints = isoCode.toUpperCase().split('').map(c => 127397 + c.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

function buildResponse(ip, cityData, asnData) {
  const isoCode = cityData?.country?.iso_code;
  return {
    ip,
    country: cityData?.country?.names?.en || null,
    city: cityData?.city?.names?.en || null,
    continent: cityData?.continent?.names?.en || null,
    location: {
      latitude: cityData?.location?.latitude || null,
      longitude: cityData?.location?.longitude || null,
      timezone: cityData?.location?.time_zone || null
    },
    isp: asnData?.autonomous_system_organization || null,
    asn: asnData?.autonomous_system_number || null,
    postal: cityData?.postal?.code || null,
    subdivision: cityData?.subdivisions?.[0]?.names?.en || null,
    vpn_or_proxy: isVPN(asnData),
    country_flag: getCountryFlag(isoCode)
  };
}

export default function handler(req, res) {
  const ip = extractIP(req);
  const cityData = cityDB.get(ip);
  const asnData = asnDB.get(ip);

  if (!cityData) return res.status(400).json({ error: "Invalid or private IP" });

  res.status(200).json(buildResponse(ip, cityData, asnData));
}
