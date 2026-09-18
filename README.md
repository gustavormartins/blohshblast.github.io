🟩 Blohsh Blast

Bem-vindo ao Blohsh Blast, um jogo de puzzle de blocos (estilo Block Blast) de código aberto, totalmente inspirado na estética dark e verde neon do ícone Blohsh da Billie Eilish.

Joga, diverte-te e contribui para o código! 🚀

🎮 Sobre o Jogo

O Blohsh Blast é um jogo de lógica onde o objetivo é encaixar peças geradas aleatoriamente numa grelha de 8x8. O jogo termina quando não houver mais espaço para colocar as peças disponíveis.

Este projeto foi construído com a simplicidade em mente: tudo funciona num único ficheiro HTML. Sem bases de dados complexas, sem servidores, apenas diversão gratuita e imediata (o que é ótimo para a carteira!).

✨ Funcionalidades

Mecânica Clássica: Arrasta e larga as peças no tabuleiro para formar linhas ou colunas completas.

Estética Exclusiva: Tema escuro (Dark Mode) com destaques em verde neon (#39ff14), inspirado no estilo da Billie Eilish.

Totalmente Responsivo: Joga perfeitamente no computador, tablet ou telemóvel (com suporte para toque/touch).

High Score: O teu recorde é guardado localmente no teu navegador (via localStorage).

Zero Dependências Locais: Funciona diretamente no browser. Usa apenas Tailwind CSS via CDN para estilização rápida.

🛠️ Tecnologias Utilizadas

HTML5 (Estrutura do tabuleiro e UI)

CSS3 (Layout responsivo, temas, efeitos e animações)

Vanilla JavaScript (Lógica do jogo, sistema de arrastar/largar e deteção de colisões)

🚀 Como Executar Localmente

Como o jogo é composto por um único ficheiro, executá-lo é incrivelmente simples:

Faz o clone deste repositório:

git clone https://github.com/gustavormartins/blohshblast.github.io.git


Navega até à pasta do projeto:

cd blohsh-blast


Dá um duplo clique no ficheiro index.html para o abrires no teu navegador web favorito.

(Opcional) Se preferires, podes usar a extensão "Live Server" no VS Code.

🤝 Como Contribuir

O Blohsh Blast é open source e todas as contribuições são muito bem-vindas! Queres adicionar novos sons, novas peças, modos de jogo ou melhorar as animações? Segue estes passos:

Faz um Fork do projeto.

Cria uma Branch para a tua funcionalidade (git checkout -b feature/NovaAnimacao).

Faz o Commit das tuas alterações (git commit -m 'Adiciona uma nova animação de explosão').

Faz o Push para a tua Branch (git push origin feature/NovaAnimacao).

Abre um Pull Request.

📝 Licença

Este projeto está licenciado sob a licença MIT - vê o ficheiro LICENSE para mais detalhes. É totalmente livre e gratuito para a comunidade!


## Fase 3 — Produto

A experiência agora inclui menu inicial, modos Classic/Zen/Hardcore/Daily, progressão permanente por XP, skins desbloqueáveis, missões diárias, desafio diário com seed determinística, PWA instalável, cache offline e leaderboard local.

### Armazenamento

A progressão, nickname, missões, scores e preferências são persistidos no navegador via localStorage. O leaderboard desta versão é deliberadamente local; a sincronização online pode ser adicionada posteriormente com um backend autenticado.

### PWA / Offline

O app usa `manifest.webmanifest`, `sw.js`, `icon.svg` e `phase3.js`. Depois do primeiro carregamento, o shell do jogo pode ser aberto sem conexão.
