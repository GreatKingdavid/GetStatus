--
-- PostgreSQL database dump
--

\restrict gFVTxAtwfF1XFyVtO7Axyen5BxnXxqlKRhncGes8IxumtgAAR2XtACgcmO9SiZv

-- Dumped from database version 17.11 (Homebrew)
-- Dumped by pg_dump version 17.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: InvitationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvitationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REVOKED',
    'EXPIRED'
);


--
-- Name: WorkspaceRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WorkspaceRole" AS ENUM (
    'OWNER',
    'ADMIN',
    'VIEWER'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: CheckResult; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CheckResult" (
    id integer NOT NULL,
    "serviceId" integer NOT NULL,
    "statusCode" integer,
    "responseTime" integer,
    "checkedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    success boolean NOT NULL,
    error text
);


--
-- Name: CheckResult_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."CheckResult_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: CheckResult_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."CheckResult_id_seq" OWNED BY public."CheckResult".id;


--
-- Name: Invitation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invitation" (
    id integer NOT NULL,
    email text NOT NULL,
    role public."WorkspaceRole" DEFAULT 'VIEWER'::public."WorkspaceRole" NOT NULL,
    status public."InvitationStatus" DEFAULT 'PENDING'::public."InvitationStatus" NOT NULL,
    "tokenHash" text NOT NULL,
    "workspaceId" integer NOT NULL,
    "invitedById" integer NOT NULL,
    "acceptedById" integer,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Invitation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Invitation_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Invitation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Invitation_id_seq" OWNED BY public."Invitation".id;


--
-- Name: Membership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Membership" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "workspaceId" integer NOT NULL,
    role public."WorkspaceRole" DEFAULT 'VIEWER'::public."WorkspaceRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Membership_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Membership_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Membership_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Membership_id_seq" OWNED BY public."Membership".id;


--
-- Name: Project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Project" (
    id integer NOT NULL,
    name text NOT NULL,
    "ownerId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "workspaceId" integer
);


--
-- Name: Project_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Project_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Project_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Project_id_seq" OWNED BY public."Project".id;


--
-- Name: Service; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Service" (
    id integer NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    "projectId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Service_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Service_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Service_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Service_id_seq" OWNED BY public."Service".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: Workspace; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Workspace" (
    id integer NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Workspace_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Workspace_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Workspace_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Workspace_id_seq" OWNED BY public."Workspace".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: CheckResult id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CheckResult" ALTER COLUMN id SET DEFAULT nextval('public."CheckResult_id_seq"'::regclass);


--
-- Name: Invitation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation" ALTER COLUMN id SET DEFAULT nextval('public."Invitation_id_seq"'::regclass);


--
-- Name: Membership id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership" ALTER COLUMN id SET DEFAULT nextval('public."Membership_id_seq"'::regclass);


--
-- Name: Project id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project" ALTER COLUMN id SET DEFAULT nextval('public."Project_id_seq"'::regclass);


--
-- Name: Service id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Service" ALTER COLUMN id SET DEFAULT nextval('public."Service_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Name: Workspace id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Workspace" ALTER COLUMN id SET DEFAULT nextval('public."Workspace_id_seq"'::regclass);


--
-- Data for Name: CheckResult; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CheckResult" (id, "serviceId", "statusCode", "responseTime", "checkedAt", success, error) FROM stdin;
1	3	200	859	2026-10-02 16:30:45.599	t	\N
2	4	200	855	2026-10-15 08:18:04.456	t	\N
3	5	200	1300	2026-10-15 08:22:11.36	t	\N
4	6	\N	10002	2026-10-15 08:25:02.029	f	Request failed or timed out
5	7	200	737	2026-10-15 09:55:49.793	t	\N
\.


--
-- Data for Name: Invitation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Invitation" (id, email, role, status, "tokenHash", "workspaceId", "invitedById", "acceptedById", "expiresAt", "acceptedAt", "createdAt") FROM stdin;
1	okwordavid1@gmail.com	VIEWER	PENDING	bb8c209478fc04b41e9b98f41c8d8f497648561aa046e5a6a345108caa75e5af	5	5	\N	2026-10-23 12:02:44.503	\N	2026-10-16 12:02:44.508
2	okingdavid5@gmail.com	VIEWER	PENDING	9bc587727764d7f8435a970dadfe1d8299f88aabf049cdff3d4df7d1618c62ee	5	5	\N	2026-10-23 14:55:08.606	\N	2026-10-16 14:55:08.606
\.


--
-- Data for Name: Membership; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Membership" (id, "userId", "workspaceId", role, "createdAt") FROM stdin;
1	1	1	OWNER	2026-10-16 13:06:54.942
2	2	2	OWNER	2026-10-16 13:06:54.942
3	3	3	OWNER	2026-10-16 13:06:54.942
4	4	4	OWNER	2026-10-16 13:06:54.942
5	5	5	OWNER	2026-10-16 13:06:54.942
6	6	6	OWNER	2026-10-16 13:06:54.942
7	7	7	OWNER	2026-10-16 14:56:58.885
\.


--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Project" (id, name, "ownerId", "createdAt", "workspaceId") FROM stdin;
1	My Status Pulse Project	1	2026-10-02 16:10:16.283	1
2	My Status Pulse Project	3	2026-10-02 16:27:51.925	3
3	My Workspace	5	2026-10-15 08:17:48.865	5
\.


--
-- Data for Name: Service; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Service" (id, name, url, "projectId", "createdAt") FROM stdin;
1	Example Website	https://example.com	1	2026-10-02 16:13:47.769
2	Example Website	https://example.com	1	2026-10-02 16:15:29.82
3	Example Website	https://example.com	2	2026-10-02 16:29:43.321
4	example	https://example.com/	3	2026-10-15 08:17:48.891
5	clock	https://fliqlo.com/	3	2026-10-15 08:22:02.016
6	fail	https://httpbin.org/status/500	3	2026-10-15 08:24:50.635
7	apple	https://www.apple.com/	3	2026-10-15 09:55:41.621
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, email, "passwordHash", "createdAt") FROM stdin;
1	test@example.com	$2b$10$QVcuOcYz5AXb7Yi6SiawxO9mSE1g2srNLAE279.RF2tSfKDPc7PbS	2026-10-02 15:58:13.459
2	test2@example.com	$2b$10$IzPSGwtRDol5sIbnTa3hweAyk6s6rQmw8pZAGcPfi9tYc/f0pToQO	2026-10-02 16:25:33.98
3	test22@example.com	$2b$10$bELdt22tuoYEslxqY1b25O47ZKhW7FUxTzHxCZ0KmglT.AHWul/AG	2026-10-02 16:26:04.689
4	test2@example2.com	$2b$10$KN1PL6Wv7ISpaPraoo92Sup/WM69x6HyNUjGO/jZkMtLIxqz3fXwG	2026-10-02 17:59:51.526
5	emma@gmail.com	$2b$10$YgTXl3AxMyr79zNZOBPo4.kH0F5S3EmBXTplJFvRzVUoKTUIZ5a/i	2026-10-15 08:16:13.536
6	emeka@gmail.com	$2b$10$CSrbLPRIIhS1iwhpYlj7KuVhyznZKou/vII3so2rm8s1f83/x21rC	2026-10-15 10:00:17.946
7	okingdavid5@gmail.com	$2b$10$RwnvV0MDjNDZdpU1IlH2ke/2a1swO0WRrXSTdp8d2KgchMJolqbje	2026-10-16 14:56:58.88
\.


--
-- Data for Name: Workspace; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Workspace" (id, name, "createdAt") FROM stdin;
1	test@example.com's workspace	2026-10-16 13:06:54.942
2	test2@example.com's workspace	2026-10-16 13:06:54.942
3	test22@example.com's workspace	2026-10-16 13:06:54.942
4	test2@example2.com's workspace	2026-10-16 13:06:54.942
5	emma@gmail.com's workspace	2026-10-16 13:06:54.942
6	emeka@gmail.com's workspace	2026-10-16 13:06:54.942
7	okingdavid5@gmail.com's workspace	2026-10-16 14:56:58.883
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
cf0d6293-6e93-408e-adad-1c83a6522e6b	a9d73345cafc01f552d311379f032d2f90e17542a051dcb4bf8644051fd8f2ec	2026-10-02 18:27:13.033123+03	20261002152713_init	\N	\N	2026-10-02 18:27:13.029775+03	1
3dcf8a46-e323-4ec6-b9cf-035c3e99308c	725aacf6a6a318ecca410191952e994319ff7923ca6a6bec8511c60a8d661742	2026-10-16 13:06:55.030554+03	20261016130000_add_workspaces_and_invitations	\N	\N	2026-10-16 13:06:54.939066+03	1
\.


--
-- Name: CheckResult_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."CheckResult_id_seq"', 5, true);


--
-- Name: Invitation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Invitation_id_seq"', 2, true);


--
-- Name: Membership_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Membership_id_seq"', 7, true);


--
-- Name: Project_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Project_id_seq"', 3, true);


--
-- Name: Service_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Service_id_seq"', 7, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."User_id_seq"', 7, true);


--
-- Name: Workspace_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Workspace_id_seq"', 7, true);


--
-- Name: CheckResult CheckResult_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CheckResult"
    ADD CONSTRAINT "CheckResult_pkey" PRIMARY KEY (id);


--
-- Name: Invitation Invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_pkey" PRIMARY KEY (id);


--
-- Name: Membership Membership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: Service Service_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Workspace Workspace_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Workspace"
    ADD CONSTRAINT "Workspace_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Invitation_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invitation_expiresAt_idx" ON public."Invitation" USING btree ("expiresAt");


--
-- Name: Invitation_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON public."Invitation" USING btree ("tokenHash");


--
-- Name: Invitation_workspaceId_email_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invitation_workspaceId_email_status_idx" ON public."Invitation" USING btree ("workspaceId", email, status);


--
-- Name: Membership_userId_workspaceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON public."Membership" USING btree ("userId", "workspaceId");


--
-- Name: Membership_workspaceId_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Membership_workspaceId_role_idx" ON public."Membership" USING btree ("workspaceId", role);


--
-- Name: Project_workspaceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Project_workspaceId_idx" ON public."Project" USING btree ("workspaceId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: CheckResult CheckResult_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CheckResult"
    ADD CONSTRAINT "CheckResult_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Invitation Invitation_acceptedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invitation Invitation_invitedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Invitation Invitation_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invitation"
    ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Membership Membership_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Membership Membership_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Project Project_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Project Project_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Service Service_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict gFVTxAtwfF1XFyVtO7Axyen5BxnXxqlKRhncGes8IxumtgAAR2XtACgcmO9SiZv

