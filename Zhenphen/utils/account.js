function clean(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}


function publicUser(user) {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    memberType: user.memberType,
    phone: user.phone,
    bio: user.bio,
    skills: user.skills
  };
}


function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}


function validImage(mime, data) {
  if (mime === 'image/png') return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/jpeg') return data[0] === 255 && data[1] === 216 && data.at(-2) === 255 && data.at(-1) === 217;
  return mime === 'image/webp' && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
}

module.exports = { clean, publicUser, validateEmail, validImage };
