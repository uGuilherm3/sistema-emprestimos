---
trigger: always_on
---

# Regra de Estilização e Componentes

## 1. Use Variáveis CSS para Cores

Ao aplicar cores, sempre prefira utilizar as variáveis CSS definidas no `:root` do arquivo `src/App.css`. Isso garante consistência com o tema (incluindo o futuro Dark Mode).

**Variáveis Principais:**
- `var(--bg-main)`: Cor de fundo principal da página.
- `var(--bg-soft)`: Cor de fundo para elementos secundários como inputs, cards e hovers sutis.
- `var(--bg-hover)`: Cor para estado de hover mais evidente.
- `var(--text-main)`: Cor do texto principal.
- `var(--text-muted)`: Cor para textos secundários, placeholders e legendas.
- `var(--accent)`: Cor de destaque para botões primários e bordas importantes.

**Exemplo de Uso Correto (em CSS ou Tailwind):**
```css
.meu-componente {
  background-color: var(--bg-soft);
  color: var(--text-main);
  border: 1px solid var(--accent);
}
```

## 2. Utilize as Classes Utilitárias Existentes

O projeto já possui um conjunto de classes de CSS bem definidas em `src/App.css` para componentes comuns. Priorize o uso delas para manter a consistência visual.

- **Inputs:** Use a classe `.input-minimal`.
- **Botões:** `.btn-dark` para ações primárias e `.btn-light` para secundárias.
- **Tabelas:** Use a estrutura com a classe `.table-minimal`.
- **Títulos de Seção:** Use a classe `.section-title`.

## 3. Tailwind CSS
Ao usar Tailwind CSS diretamente, evite cores "hardcoded" como `bg-gray-200` ou `text-blue-500`. O design do projeto é minimalista e monocromático, inspirado no design editorial. Siga a referência da pasta "Inspiration" e as variáveis CSS.