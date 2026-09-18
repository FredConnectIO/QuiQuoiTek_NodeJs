const express = require('express');
const bodyParser = require('body-parser');
const quisRouter = require('./routes/quis');
const quoisRouter = require('./routes/quois');
const rolesRouter = require('./routes/roles');
const postesRouter = require('./routes/postes');
const photosRouter = require('./routes/photos');
const themesRouter = require('./routes/themes');
const parametresRouter = require('./routes/parametres');
const relThemesRouter = require('./routes/relthemes');
const toolsRouter = require('./routes/tools');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/quis', quisRouter);
app.use('/quois', quoisRouter);
app.use('/photos', photosRouter);
app.use('/roles', rolesRouter);
app.use('/postes', postesRouter);
app.use('/themes', themesRouter);
app.use('/parametres', parametresRouter);
app.use('/relthemes', relThemesRouter);
app.use('/tools', toolsRouter);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
