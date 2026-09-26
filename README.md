# Hermeneia Runtime 5.0

Runtime remoto modular do Hermeneia.

## Estrutura

```text
manifest.json
modules/
  lexicon.js
  cache.js
  core.js
  ambiguo.js
  deep-parser.js
  realizer.js
  redator.js
  ai.js
  hypothesis.js
  app.js
```

## Uso

Este repositório é consumido pelo microkernel do Hermeneia 5.0. O `index.html` do Google Apps Script carrega `manifest.json` e, em seguida, os módulos necessários por HTTPS.

Para produção, prefira uma URL jsDelivr fixada a um commit específico:

```text
https://cdn.jsdelivr.net/gh/Daudanir/hermeneia-runtime@COMMIT_SHA
```

O microkernel acrescenta `/manifest.json` e os caminhos de `modules/` conforme necessário.

## Componentes

- `lexicon.js`: recursos e utilidades lexicais.
- `cache.js`: cache local/IndexedDB.
- `core.js`: análise estrutural principal.
- `ambiguo.js`: PPMI e desambiguação distribucional.
- `deep-parser.js`: parsing profundo e dependências.
- `realizer.js`: realização linguística.
- `redator.js`: composição textual determinística.
- `ai.js`: provedores locais de IA e fallback.
- `hypothesis.js`: Apótica, hipóteses e composição.
- `app.js`: integração da aplicação e interface.

## Regra metodológica

A análise interna, hipóteses e evidências externas permanecem separadas. IA e pesquisa enriquecem ou explicam resultados; não devem sobrescrever silenciosamente o Estado Semântico.
