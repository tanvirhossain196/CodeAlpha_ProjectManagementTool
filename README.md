# ShilpoSetu (শিল্পসেতু)

ShilpoSetu is a responsive industrial project execution workspace built with the original project stack: Vanilla JavaScript, semantic HTML/CSS, Node.js, Express, PostgreSQL and Socket.IO.

Version 2.0 turns the original project-management tool into a professional operations command centre suitable for engineering, manufacturing, construction, logistics, technology and service-delivery teams.

## Highlights

- Industrial command-centre interface with low-radius cards, controls and work surfaces
- Collapsible desktop sidebar, tablet navigation drawer and mobile bottom navigation
- Responsive layouts for desktop, tablet and mobile
- Light, dark and system colour modes
- Comfortable and compact density modes plus reduced-motion support
- Project codes, departments, clients/business units and personal priority watch
- Five-stage Kanban work-order flow with drag-and-drop status updates
- Task estimates, execution checklists and time/effort logs
- Rich professional profiles with role, department, location, phone, bio and timezone
- Project membership and OWNER / ADMIN / MEMBER authorization
- Dashboard focus queue, deadline control, capacity signal and audit stream
- Operational reports for project health, workload, status, priority and effort
- CSV exports for assigned tasks and project reports
- Real-time task, comment, checklist, time-log and notification events
- Search across projects, project codes, clients, tasks and people
- Notification inbox with unread filters and contextual links

## Technology

| Layer | Technology |
| --- | --- |
| Client | HTML5, CSS3, Vanilla JavaScript ES modules |
| API | Node.js 20+, Express 4 |
| Database | PostgreSQL 16 |
| Authentication | JWT and bcrypt |
| Real-time | Socket.IO |
| Security | Helmet, CORS, rate limiting, parameterized SQL |
| Validation | Server-side validation and normalized text inputs |

## Quick start

### 1. Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 14 or newer, or Docker Compose

### 2. Install dependencies

```bash
npm ci
```

### 3. Start PostgreSQL

The included Compose file exposes PostgreSQL on host port `55433`:

```bash
docker compose up -d postgres
```

### 4. Configure the application

```bash
cp .env.example .env
```

Replace `JWT_SECRET` with a random value of at least 32 characters. The default example database URL matches the Compose service:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:55433/shilposetu
```

### 5. Apply database migrations

```bash
npm run db:migrate
```

Migrations are tracked in `schema_migrations`, applied in filename order and wrapped in transactions.

### 6. Start ShilpoSetu

Development:

```bash
npm run dev
```

Production-style:

```bash
npm start
```

Open [http://localhost:4000](http://localhost:4000) and create the first user through the registration screen.

## Project structure

```text
client/
  css/                 Design system and responsive interface
  js/                  Page modules, API client, real-time and UI helpers
  *.html               Application and authentication screens
database/
  migrations/          Ordered PostgreSQL schema migrations
  seeds/               Optional safe seed entry point
server/
  controllers/         HTTP request handling
  db/                  Pool, migration and seed runners
  middleware/          Authentication, access control, errors and rate limits
  routes/              API route definitions
  services/            Business and persistence logic
  sockets/             Socket.IO authentication and project rooms
tests/                  Node test suite
```

## Main screens

| Screen | Purpose |
| --- | --- |
| Command centre | Portfolio metrics, focus queue, deadlines, capacity and live activity |
| Projects | Searchable portfolio, priority watch and project creation |
| Project board | Five-stage Kanban, work-order filters and project control data |
| Task detail | Checklist, time log, comments, activity and status control |
| My work orders | Cross-project register, filters, progress and CSV export |
| People & access | Project membership, roles and open workload |
| Operational reports | Project health, delivery mix, effort and team capacity |
| Notifications | Assignments, decisions, deadlines and access events |
| Profile | Professional identity and operating context |
| Settings | Theme, density, motion and navigation preferences |

## Authorization model

| Capability | Member | Admin | Owner |
| --- | :---: | :---: | :---: |
| View project and tasks | Yes | Yes | Yes |
| Create tasks | Yes | Yes | Yes |
| Edit own reported/assigned tasks | Yes | Yes | Yes |
| Manage project settings | No | Yes | Yes |
| Add or remove members | No | Yes | Yes |
| Change member roles | No | No | Yes |
| Delete project | No | No | Yes |

Project membership is checked on protected project routes and task access is verified before task, comment, checklist and effort records are returned.

## API overview

All JSON responses follow this shape:

```json
{
  "success": true,
  "message": "Operation completed.",
  "data": {}
}
```

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Projects and membership

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`
- `PATCH /api/projects/:id/star`
- `GET /api/projects/:id/members`
- `POST /api/projects/:id/members`
- `PUT /api/projects/:id/members/:userId`
- `DELETE /api/projects/:id/members/:userId`

### Tasks and execution

- `GET /api/tasks`
- `GET /api/projects/:id/tasks`
- `POST /api/projects/:id/tasks`
- `GET /api/tasks/:id`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `PATCH /api/tasks/:id/assignee`
- `GET /api/tasks/:id/activity`

### Checklists and time logs

- `GET /api/tasks/:id/checklist`
- `POST /api/tasks/:id/checklist`
- `PATCH /api/checklist/:id`
- `DELETE /api/checklist/:id`
- `GET /api/tasks/:id/time`
- `POST /api/tasks/:id/time`
- `DELETE /api/time/:id`

### Collaboration and intelligence

- `GET /api/tasks/:id/comments`
- `POST /api/tasks/:id/comments`
- `PUT /api/comments/:id`
- `DELETE /api/comments/:id`
- `GET /api/dashboard`
- `GET /api/reports`
- `GET /api/search?q=...`
- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

## Database migrations

- `001_initial.sql` creates users, projects, membership, tasks, labels, comments, notifications and activity logs.
- `002_industrial_features.sql` adds professional profile fields, industrial project metadata, project priority watch, task estimates, completion timestamps, checklists and time entries.

## Quality checks

```bash
npm run check
npm test
```

`npm run check` validates the syntax of server, client and test JavaScript files. The test suite uses Node's built-in test runner.

## Production checklist

- Use a long, unique `JWT_SECRET` stored outside source control.
- Set `NODE_ENV=production`.
- Restrict `CORS_ORIGIN` to the deployed application origin.
- Use a managed PostgreSQL instance with backups and TLS.
- Terminate HTTPS at a reverse proxy or platform load balancer.
- Run `npm run db:migrate` before starting a newly deployed release.
- Keep `.env`, database dumps and uploaded private data out of the repository.

## Brand

**ShilpoSetu (শিল্পসেতু)** means a bridge for industry—connecting people, plans and execution in one accountable operating system.
