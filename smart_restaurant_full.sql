--
-- PostgreSQL database dump
--

\restrict efnOY487vWym2QFn8Akhc83RMVv2erzN9R4OrTRNNuv3Pks23EUeHBaCZjWccuU

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

-- Started on 2026-08-27 08:44:23 UTC

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 225 (class 1259 OID 16469)
-- Name: Employee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Employee" (
    employee_id integer NOT NULL,
    firstname character varying(100) NOT NULL,
    lastname character varying(100) NOT NULL,
    role character varying(30) NOT NULL
);


--
-- TOC entry 224 (class 1259 OID 16449)
-- Name: Ingredient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Ingredient" (
    ingredient_id integer NOT NULL,
    name character varying(100)
);


--
-- TOC entry 220 (class 1259 OID 16398)
-- Name: Order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Order" (
    order_id integer NOT NULL,
    table_id integer NOT NULL,
    employee_id integer
);


--
-- TOC entry 221 (class 1259 OID 16410)
-- Name: Order_Item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Order_Item" (
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    order_item_id integer NOT NULL,
    status character varying(30) NOT NULL
);


--
-- TOC entry 222 (class 1259 OID 16420)
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    product_id integer NOT NULL,
    description character varying(100),
    price numeric DEFAULT 0.0 NOT NULL,
    type character varying(50) NOT NULL,
    name character varying(100) NOT NULL
);


--
-- TOC entry 223 (class 1259 OID 16435)
-- Name: Product_Ingredient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product_Ingredient" (
    product_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    amount integer DEFAULT 0 NOT NULL
);


--
-- TOC entry 219 (class 1259 OID 16389)
-- Name: Table; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Table" (
    table_id integer NOT NULL,
    table_number integer NOT NULL,
    seats integer DEFAULT 0 NOT NULL
);


--
-- TOC entry 3522 (class 0 OID 16469)
-- Dependencies: 225
-- Data for Name: Employee; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Employee" (employee_id, firstname, lastname, role) FROM stdin;
1	Anna	Schmidt	service
2	Leon	Weber	kitchen
3	Mira	Hoffmann	bar
4	Noah	Fischer	admin
5	Sofia	Wagner	service
\.


--
-- TOC entry 3521 (class 0 OID 16449)
-- Dependencies: 224
-- Data for Name: Ingredient; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Ingredient" (ingredient_id, name) FROM stdin;
1	Tomato
2	Bread
3	Garlic
4	Basil
5	Olive oil
6	Lettuce
7	Chicken
8	Parmesan
9	Croutons
10	Flour
11	Mozzarella
12	Salami
13	Pasta
14	Chili
15	Beef patty
16	Burger bun
17	Cheese
18	Potato
19	Salt
20	Mascarpone
21	Coffee
22	Cocoa
23	Egg
24	Sugar
25	Rice
26	Coconut milk
27	Vegetables
28	Curry paste
\.


--
-- TOC entry 3517 (class 0 OID 16398)
-- Dependencies: 220
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Order" (order_id, table_id, employee_id) FROM stdin;
1	1	1
2	3	2
3	5	3
4	2	1
5	6	4
6	4	2
7	7	5
8	8	3
9	3	\N
10	5	4
\.


--
-- TOC entry 3518 (class 0 OID 16410)
-- Dependencies: 221
-- Data for Name: Order_Item; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Order_Item" (order_id, product_id, order_item_id, status) FROM stdin;
1	3	1	served
1	9	2	served
2	6	3	ready
2	7	4	ready
2	10	5	served
3	2	6	in_progress
3	4	7	in_progress
3	11	8	served
4	5	9	new
4	9	10	new
5	13	11	in_progress
5	10	12	served
6	1	13	served
6	3	14	remake_requested
6	12	15	served
7	6	16	ready
7	9	17	served
7	8	18	new
8	4	19	in_progress
8	4	20	in_progress
8	11	21	served
9	3	22	new
9	10	23	new
10	2	24	ready
10	8	25	new
\.


--
-- TOC entry 3519 (class 0 OID 16420)
-- Dependencies: 222
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Product" (product_id, description, price, type, name) FROM stdin;
1	Toasted bread with tomatoes, garlic and basil	6.50	starter	Bruschetta
2	Salad with chicken, parmesan and croutons	10.90	starter	Caesar Salad
3	Pizza with tomato, mozzarella and basil	10.50	main_course	Pizza Margherita
4	Pizza with tomato, mozzarella and salami	12.50	main_course	Pizza Salami
5	Pasta with spicy tomato and garlic sauce	11.90	main_course	Pasta Arrabbiata
6	Beef burger with cheese, lettuce and tomato	14.90	main_course	Cheeseburger
7	Crispy fries with salt	4.50	side_dish	French Fries
8	Italian dessert with coffee and mascarpone	6.90	dessert	Tiramisu
9	Cola, 0.4 l	3.50	drink	Cola
10	Sparkling mineral water, 0.5 l	2.80	drink	Mineral Water
11	Apple spritzer, 0.4 l	3.60	drink	Apple Spritzer
12	Freshly prepared espresso	2.50	drink	Espresso
13	Vegetable curry with coconut milk and rice	13.50	main_course	Vegan Curry
\.


--
-- TOC entry 3520 (class 0 OID 16435)
-- Dependencies: 223
-- Data for Name: Product_Ingredient; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Product_Ingredient" (product_id, ingredient_id, amount) FROM stdin;
1	2	80
1	1	60
1	3	5
1	4	3
1	5	10
2	6	100
2	7	120
2	8	20
2	9	30
3	10	180
3	1	80
3	11	100
3	4	3
4	10	180
4	1	80
4	11	100
4	12	70
5	13	180
5	1	120
5	3	5
5	14	3
6	15	180
6	16	90
6	17	30
6	6	20
6	1	30
7	18	200
7	5	20
7	19	3
8	20	80
8	21	30
8	22	10
8	23	40
8	24	30
12	21	8
13	25	150
13	26	120
13	27	180
13	28	20
\.


--
-- TOC entry 3516 (class 0 OID 16389)
-- Dependencies: 219
-- Data for Name: Table; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Table" (table_id, table_number, seats) FROM stdin;
1	1	2
2	2	2
3	3	4
4	4	4
5	5	4
6	6	6
7	7	6
8	8	8
\.


--
-- TOC entry 3362 (class 2606 OID 16478)
-- Name: Employee Employee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Employee"
    ADD CONSTRAINT "Employee_pkey" PRIMARY KEY (employee_id);


--
-- TOC entry 3360 (class 2606 OID 16457)
-- Name: Ingredient Ingredient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Ingredient"
    ADD CONSTRAINT "Ingredient_pkey" PRIMARY KEY (ingredient_id);


--
-- TOC entry 3354 (class 2606 OID 16468)
-- Name: Order_Item Order_Item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order_Item"
    ADD CONSTRAINT "Order_Item_pkey" PRIMARY KEY (order_item_id);


--
-- TOC entry 3352 (class 2606 OID 16404)
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (order_id);


--
-- TOC entry 3358 (class 2606 OID 16487)
-- Name: Product_Ingredient Product_Ingredient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product_Ingredient"
    ADD CONSTRAINT "Product_Ingredient_pkey" PRIMARY KEY (product_id, ingredient_id);


--
-- TOC entry 3356 (class 2606 OID 16429)
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (product_id);


--
-- TOC entry 3350 (class 2606 OID 16397)
-- Name: Table Table_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Table"
    ADD CONSTRAINT "Table_pkey" PRIMARY KEY (table_id);


--
-- TOC entry 3363 (class 2606 OID 16479)
-- Name: Order employee_order_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT employee_order_fk FOREIGN KEY (employee_id) REFERENCES public."Employee"(employee_id) NOT VALID;


--
-- TOC entry 3367 (class 2606 OID 16458)
-- Name: Product_Ingredient ingredient_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product_Ingredient"
    ADD CONSTRAINT ingredient_id_fk FOREIGN KEY (ingredient_id) REFERENCES public."Ingredient"(ingredient_id) NOT VALID;


--
-- TOC entry 3365 (class 2606 OID 16415)
-- Name: Order_Item order_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order_Item"
    ADD CONSTRAINT order_id_fk FOREIGN KEY (order_id) REFERENCES public."Order"(order_id);


--
-- TOC entry 3366 (class 2606 OID 16430)
-- Name: Order_Item product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order_Item"
    ADD CONSTRAINT product_id_fk FOREIGN KEY (product_id) REFERENCES public."Product"(product_id) NOT VALID;


--
-- TOC entry 3368 (class 2606 OID 16442)
-- Name: Product_Ingredient product_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product_Ingredient"
    ADD CONSTRAINT product_id_fk FOREIGN KEY (product_id) REFERENCES public."Product"(product_id);


--
-- TOC entry 3364 (class 2606 OID 16405)
-- Name: Order table_order_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT table_order_fk FOREIGN KEY (table_id) REFERENCES public."Table"(table_id);


-- Completed on 2026-08-27 08:44:23 UTC

--
-- PostgreSQL database dump complete
--

\unrestrict efnOY487vWym2QFn8Akhc83RMVv2erzN9R4OrTRNNuv3Pks23EUeHBaCZjWccuU

