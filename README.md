# FOFL — Football FieLd Sim · Community Access

> **BETA** — Simulador de campo de futebol americano no navegador, sem dependências de servidor.

Live: [filipenascimento.github.io/football-field-automate-community](https://filipenascimento.github.io/football-field-automate-community) *(GitHub Pages)*

---

## Visão geral

Ferramenta interativa para criação, visualização e animação de jogadas de futebol americano. O campo é renderizado em um `<canvas>` 800×480 px com proporções reais de campo NFL (100 jardas × 53,3 jardas) visto de cima (*bird's eye view*).

---

## Funcionalidades

### Campo
- Linhas de 10 jardas (branco sólido) e 5 jardas (branco semitransparente)
- **Hashmarks** no padrão NFL — 14,875 jardas de cada sideline (separação de 70'9" entre as hashes), marcas a cada jarda
- Números de jarda (10 → 50 → 10) posicionados a ~9 jardas de cada sideline
- End zones com texto "END ZONE" rotacionado
- Sistema de coordenadas nos eixos X (0–100) e Y (0–53)

### Jogadores
| Ação | Como fazer |
|---|---|
| Adicionar jogador | Botão **+** nos painéis Ataque / Defesa |
| Mover | Clicar e arrastar no canvas |
| Selecionar múltiplos | Segurar **Shift** ou **Ctrl/Cmd** e clicar |
| Editar label (até 3 letras) | **Duplo clique** no jogador |
| Gravar rota | **Clique direito** no jogador |
| Remover | Botão **Remover** no painel lateral |

Máximo de **22 jogadores** (11 ataque + 11 defesa). Ataque em azul, defesa em vermelho.

### Gravação de rotas
1. Clique direito sobre o jogador → modal de gravação
2. **Iniciar gravação** → arraste o jogador pelo campo
3. **Parar gravação** → **Salvar movimento**
4. Use **〰** para mostrar/ocultar rotas individualmente ou globalmente

### Animação
| Botão | Ação |
|---|---|
| ▶ | Inicia animação de todas as rotas gravadas |
| ↺ | Restaura todos os jogadores às posições originais |
| ✕ | Apaga todos os movimentos sem mover os jogadores |

### Formações rápidas

**Ataque**
| Botão | Formação |
|---|---|
| 🥪 | Linha Ofensiva (T-G-C-G-T) |
| IF | I-Formation |
| ⬅ | Trips Stack Esquerda |
| ➡ | Trips Stack Direita |
| 2x2 | Ace 2×2 |
| 3x1 | Trey TE 3×1 |

**Defesa**
| Botão | Formação |
|---|---|
| 🐶 | Front 4-2 (E-T-T-E + M-S) |
| 👻 | Front 3-3 (E-T-E + W-M-S) |
| 🦈 | Front 3-4 (E-T-E + W-M-S-B) |

### Salvar, carregar e exportar
| Botão | Ação |
|---|---|
| 💾 | Exporta formação atual como `.json` |
| 📂 | Carrega formação a partir de `.json` |
| 📋 | Abre galeria de playbooks pré-carregados |
| 🗑️ | Limpa o campo inteiro |
| ⬇ Exportar GIF | Gera e baixa animação `.gif` da jogada |

### Troca de cores do campo
Acesse [`cores.html`](cores.html) para visualizar o campo nas quatro cores disponíveis (verde, vermelho, amarelo, azul) e escolher o visual desejado.

---

## Estrutura do projeto

```
football-field-automate-community/
├── index.html          # UI principal + estilos inline
├── script.js           # Toda a lógica (canvas, jogadores, animação, I/O)
├── cores.html          # Preview de cores do campo
├── playbook/
│   ├── manifest.json   # Índice de categorias da galeria de playbooks
│   └── formation.json  # Exemplo de formação salva
└── .github/
    └── workflows/
        └── deploy.yml  # Deploy automático no GitHub Pages (push em main)
```

### Galeria de playbooks

Para adicionar plays à galeria, edite `playbook/manifest.json` seguindo o formato:

```json
{
  "categories": [
    {
      "name": "Nome da categoria",
      "files": [
        { "label": "Nome da jogada", "path": "playbook/nome-do-arquivo.json" }
      ]
    }
  ]
}
```

Cada arquivo `.json` referenciado deve seguir o schema exportado pelo botão 💾.

---

## Stack

- HTML5 + CSS3 + JavaScript ES6+ (sem frameworks)
- [`gif.js`](https://github.com/jnordberg/gif.js) para exportação de GIF
- GitHub Pages para hospedagem estática

---

## Autor

Criado por [@filipenascimento](https://github.com/filipenascimento) · GitLab: [@lipe.nscm](https://gitlab.com/lipe.nscm)
