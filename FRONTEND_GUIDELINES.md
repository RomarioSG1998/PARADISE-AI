# Paradise AI — Diretrizes de Desenvolvimento Frontend

Para evitar o acúmulo de código monolítico e garantir a escalabilidade e a legibilidade do projeto, foi estabelecido um padrão obrigatório de modularização para todos os scripts JavaScript de frontend.

---

## 1. Princípio da Responsabilidade Única (Separation of Concerns)
Nenhum arquivo JavaScript individual deve ultrapassar o limite recomendado de **300 linhas de código**. Caso uma aplicação cresça em complexidade, ela deve ser dividida em submódulos específicos sob o diretório `/static/js/<nome_do_app>/`.

### Arquitetura Padrão Recomendada:
* **`state.js`**: Centraliza todas as variáveis mutáveis de controle (estado da aplicação, arrays de histórico, flags booleanas).
* **`elements.js`**: Isola todos os seletores de elementos do DOM (por exemplo, `document.getElementById`).
* **`translations.js`**: Guarda exclusivamente as mensagens, textos dinâmicos e internacionalização (dicionários multilíngues).
* **`main.js`**: Ponto de entrada (`entrypoint`) que importa os submódulos, escuta eventos e orquestra a inicialização.
* **Módulos Específicos (ex: `player.js`, `recorder.js`, `voice.js`)**: Guardam funções utilitárias ou regras de negócio isoladas.

---

## 2. Configuração de Carregamento (ES6 Modules)
Todas as referências nos templates HTML (`templates/*.html`) devem utilizar carregamento nativo de módulos ES6:

```html
<!-- Exemplo de inclusão recomendada no rodapé do template -->
<script type="module" src="{{ url_for('static', filename='js/<nome_do_app>/main.js') }}"></script>
```

---

## 3. Diretiva de Exportação e Importação
* Use `export` explícito (seja nomeado ou default) para disponibilizar funções, objetos de estado ou dicionários de tradução.
* Sempre inclua a extensão `.js` nas diretivas de importação relativas.

**Exemplo (`main.js`):**
```javascript
import { state } from './state.js';
import { elements } from './elements.js';
import { speakText } from './voice.js';
```

---

## 4. Manutenção Futura
Sempre que uma nova funcionalidade frontend for solicitada ou criada no projeto, **ela deve seguir obrigatoriamente essa estrutura modular**. Evite concatenar funções de propósitos distintos em um único arquivo `.js`.
