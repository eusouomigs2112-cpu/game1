# ONÍRIA — um jogo dreamcore em 3D

Um passeio contemplativo em primeira pessoa por um espaço liminar pastel:
névoa, água reflexiva, lua gigante, monólitos e portas soltas no vazio.
Vagueie e recolha as **memórias** flutuantes — cada uma sussurra algo.
Não há como perder; só há o sonho. A cada 8 memórias o sonho troca de cor.

## Jogar

Abra **`oniria.html`** no navegador (é um arquivo único, sem dependências
externas — funciona offline, inclusive com dois cliques).

Controles: **WASD** mover · **Shift** correr · **Mouse** olhar ·
**M** som · **+/−** qualidade (ultra/leve) · **Esc** acordar.

## Tecnologia

- [Three.js](https://threejs.org) r160 (WebGL) empacotado no próprio HTML.
- Pós-processamento: bloom, SSAO (oclusão de ambiente), profundidade de campo
  (bokeh), aberração cromática, vinheta e grão de filme.
- Água reflexiva animada, sombras suaves, luzes dinâmicas e ambiente PBR.

## Build

O `oniria.html` já vem pronto. Para regerar a partir do código-fonte:

```bash
npm install          # baixa three + esbuild
npm run build        # gera oniria.html a partir de src/game.js
```

Editar `src/game.js` (lógica/gráficos) ou `oniria.template.html` (HTML/CSS/HUD)
e rodar `npm run build` reempacota tudo num único `oniria.html`.
