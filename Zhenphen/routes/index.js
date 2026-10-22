const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { home } = require('../controllers/indexController');

router.get('/', home);

// Register only known templates; request paths are never passed to res.render.
// Preserve existing links, bookmarks, and emailed verification/reset URLs.
const views = path.join(__dirname, '..', 'views');
for (const file of fs.readdirSync(views).filter(file => file.endsWith('.ejs'))) {
  const name = path.basename(file, '.ejs');
  router.get(`/${name}.html`, (req, res) => res.render(name));
}

module.exports = router;
