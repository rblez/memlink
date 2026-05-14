**Memlink — Lo que estamos construyendo**

Memoria persistente, estructurada y universal para agentes de IA. No un bloc de notas. No un archivo de texto. Una base de datos de hechos que cualquier agente puede leer, escribir y razonar.

---

**Core**
- Memoria en JSON — un solo archivo por agente, parseable, editable, sin regex
- Renderer CLI — `memlink memory show` convierte el JSON a markdown legible para humanos
- Hechos estructurados — cada entrada tiene contenido, tags, fecha y relevancia
- Memoria semántica — el agente detecta entradas antiguas, duplicadas o desactualizadas
- MCP nativo — compatible con Cursor, Windsurf, Claude, cualquier agente via Streamable HTTP
- Token único por memoria — `memlink_<32chars>`, solo el hash en DB, nunca en texto plano

**Acceso**
- Query string por defecto — una URL, la pegas en el IDE y listo
- Bearer header opcional — para devs que quieren el estándar
- OAuth 2.1 — roadmap, cuando los agentes lo soporten nativamente

**Cloud**
- Multi-tenant — cada usuario tiene sus memorias aisladas
- Rate limiting por plan — 100 req/day en Free, ilimitado en Pro
- Planes: Free / Pro $9 / Team $6 por seat (mín. 5) / Enterprise custom
- Stripe integrado — upgrade en un click desde el dashboard
- Dashboard minimalista — crear memoria, copiar config MCP, ver uso

**Self-hosted**
- CLI instalable en una línea — `curl rblez.com/memlink/install.sh | bash`
- Sin dependencias externas — un binario, corre en cualquier VPS
- Tus datos, tu servidor, tu control total

**Roadmap**
- Memoria compartida entre agentes del mismo workspace
- Detección automática de hechos desactualizados
- Versioning — cada write guarda un snapshot
- Search semántico — buscar por significado, no solo por texto
- Integración nativa con memoria de Cursor, Windsurf y Claude
- API pública para integraciones de terceros

---

*Memlink = tu agente recuerda. Tú decides qué.*