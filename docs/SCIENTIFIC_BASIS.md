# Научная база и методология AI-Finder

AI-Finder выполняет анализ текста, документов, изображений и исходного кода на признаки машинной генерации с использованием детерминированных эвристик, методов классической математической статистики, теории информации и цифровой криминалистики (forensics).

Весь анализ выполняется локально в браузере (на стороне клиента), не отправляя пользовательские данные на внешние серверы и не обращаясь к внешним LLM.

Ниже приведен перечень ключевых рецензируемых исследований, препринтов и стандартов, подтверждающих валидность используемых в проекте алгоритмов.

---

## 1. Лексические аномалии и словарь маркеров (детекторы `L-01`, `L-04`)

Языковые модели обладают характерными лексическими предпочтениями: они переиспользуют определенный набор вводных оборотов, абстрактных связок и оценочных прилагательных, частотность которых в естественной человеческой речи на порядки ниже.

* **[Delving into ChatGPT usage in academic writing through excess vocabulary](https://arxiv.org/abs/2406.07016)** (Dmitry Kobak, Rita González-Márquez et al., 2024, arXiv:2406.07016).
  * *Результаты:* Анализ сотен тысяч академических публикаций в PubMed выявил резкий скачок частотности сотен специфических слов после 2022 года (*delve*, *testament*, *pivotal*, *crucial*, *tapestry*, *intricate*, *comprehensive*, *streamline*).
  * *Применение в проекте:* Словари в `rules/markers.yaml` (отдельно для RU и EN) отслеживают плотность таких маркеров на 1000 слов.
* **[Monitoring AI-Modified Content at Scale: A Case Study on the Impact of ChatGPT on AI Conference Peer Reviews](https://arxiv.org/abs/2403.07183)** (Weixin Liang, Zachary Izzo, Yaohui Zhang et al., ICML 2024, arXiv:2403.07183).
  * *Результаты:* Выявлена выраженная склонность LLM к формализованному канцеляриту, пассивному залогу и шаблонным эпитетам при обобщении информации.
  * *Применение в проекте:* Оценка плотности хеджирования, отглагольных существительных и шаблонных конструкций (`L-04`).

---

## 2. Ритмика, длина предложений и Burstiness (детекторы `R-01` – `R-05`)

Человеческий стиль письма характеризуется высокой вариативностью («взрывным характером» — *burstiness*): люди спонтанно чередуют лаконичные фразы, риторические вопросы и развернутые синтаксические конструкции. В свою очередь, авторегрессионные языковые модели стремятся максимизировать среднее правдоподобие, что приводит к монотонной длине предложений и предсказуемой синтаксической сложности.

* **[What is perplexity & burstiness for AI detection?](https://gptzero.me/news/perplexity-and-burstiness-what-is-it/)** (Edward Tian, GPTZero, 2023).
  * *Результаты:* Популяризирует пару признаков «перплексия + burstiness»: у человеческого текста выше вариация длины предложений и локальной перплексии. Конкретные пороги AI-Finder (ориентиры $CV > 0.5$ для человека и $CV < 0.35$ для ИИ) взяты из ТЗ проекта и калибруются на корпусе (`rules/detectors.yaml`).
  * *Применение в проекте:* Детектор `R-01` рассчитывает коэффициент вариации $CV = \sigma / \mu$ для длин предложений; детектор `R-02` отслеживает отсутствие экстремально коротких и длинных предложений.
* **[Feature-Based Detection of AI-Generated Text: An Analysis of Stylometric and Perplexity Markers in Contemporary Large Language Models](https://www.researchgate.net/publication/398588043_Feature-Based_Detection_of_AI-Generated_Text_An_Analysis_of_Stylometric_and_Perplexity_Markers_in_Contemporary_Large_Language_Models)** (2025).
  * *Результаты:* Подтверждено, что стилометрические характеристики распределения длины предложений и расстояния между знаками препинания являются одними из самых устойчивых признаков синтетического текста.

---

## 3. Теория информации и алгоритмы сжатия (детектор `P-02`)

В силу авторегрессионной природы языковые модели выбирают наиболее вероятные продолжения фраз, уменьшая энтропию текста. В результате сгенерированный текст обладает более высокой степенью повторяемости паттернов и сжимается алгоритмами сжатия без потерь эффективнее и равномернее, чем человеческий текст.

* **[“Low-Resource” Text Classification: A Parameter-Free Classification Method with Compressors](https://aclanthology.org/2023.findings-acl.426/)** (Zhiying Jiang, Matthew Y.R. Yang, Mikhail Tsirlin et al., Findings of ACL 2023).
  * *Результаты:* Доказана возможность классификации текстов с помощью стандартных компрессоров (gzip) и метрики NCD (Normalized Compression Distance) без нейросетевых классификаторов.
  * *Применение в проекте:* Коэффициент сжатия фрагмента текста алгоритмом deflate (библиотека `fflate`, синхронно в браузере); пороги заданы отдельно для RU и EN.
* **[Language Modeling Is Compression](https://arxiv.org/abs/2309.10668)** (Grégoire Delétang, Anian Ruoss, Paul-Ambroise Duquenne et al., ICLR 2024, arXiv:2309.10668).
  * *Результаты:* Математическое доказательство глубокой взаимосвязи между энтропией языковой модели и алгоритмами сжатия данных.

---

## 4. Локальная перплексия и n-граммные модели (детектор `P-01`)

* **[GLTR: Statistical Detection and Visualization of Generated Text](https://aclanthology.org/P19-3019/)** (Sebastian Gehrmann, Hendrik Strobelt, Alexander M. Rush, ACL 2019, arXiv:1906.04043).
  * *Результаты:* Предложен метод визуализации и детекции генерации по рангу токенов в словаре базовой вероятностной модели. Тексты, созданные ИИ, концентрируются в топ-10/топ-100 наиболее вероятных слов.
  * *Применение в проекте:* Компактные символьные триграммные модели (`rules/models/ngram-ru.json`, `rules/models/ngram-en.json`, ~100 КБ каждая) обучены на выдержках из Википедии (`scripts/train_ngram.ts`). По ним считается кросс-энтропия каждого предложения; признак — её вариация по тексту. Это упрощённый аналог идеи GLTR, без нейросетевой модели.
* **[DetectGPT: Zero-Shot Machine-Generated Text Detection using Probability Curvature](https://proceedings.mlr.press/v202/mitchell23a.html)** (Eric Mitchell, Yoonho Lee, Alexander Khazatsky et al., ICML 2023, arXiv:2301.11305).
  * *Результаты:* Демонстрация того, что машинный текст лежит в локальных максимумах логарифмического правдоподобия в отличие от текстов, созданных человеком.

---

## 5. Корпуса и бенчмарки детекции (включая русский язык)

Для калибровки порогов и логистической регрессии в AI-Finder применяются открытые размеченные наборы данных:

* **[Findings of the The RuATD Shared Task 2022 on Artificial Text Detection in Russian](https://arxiv.org/abs/2206.01583)** (Tatiana Shamardina, Vladislav Mikhailov et al., Dialogue 2022, arXiv:2206.01583).
  * Общепринятый эталонный бенчмарк для задачи классификации сгенерированных текстов на русском языке.
* **[M4: Multi-Generator, Multi-Domain, and Multi-Lingual Black-Box Machine-Generated Text Detection](https://aclanthology.org/2024.eacl-long.83/)** (Yuxia Wang, Jonibek Mansurov, Petar Ivanov et al., EACL 2024, arXiv:2305.14902).
  * Крупномасштабный бенчмарк, подтверждающий состоятельность комбинированных подходов при детекции текстов различных генеративных архитектур.
* **[AINL-Eval 2025 Shared Task: Detection of AI-Generated Scientific Abstracts in Russian](https://arxiv.org/abs/2508.09622)** (2025, arXiv:2508.09622).
  * Специализированное соревнование по выявлению сгенерированных научных аннотаций в русскоязычном домене.

---

## 6. Цифровая криминалистика документов и изображений

* **Частотный спектральный анализ изображений (`I-04`):**
  * **[Leveraging Frequency Analysis for Deep Fake Image Recognition](https://proceedings.mlr.press/v119/frank20a.html)** (Joel Frank, Thorsten Eisenhofer, Lea Schönherr et al., ICML 2020, arXiv:2003.08685).
  * Исследование спектра Фурье (2D FFT) для выявления периодических артефактов и неестественных пиков в частотной области, вызванных блоками апсемплинга.
* **Артефакты диффузионных моделей (`I-05`, `I-06`):**
  * **[On The Detection of Synthetic Images Generated by Diffusion Models](https://arxiv.org/abs/2211.00680)** (Riccardo Corvi, Davide Cozzolino et al., IEEE ICASSP 2023, arXiv:2211.00680).
  * Анализ отсутствия сенсорного шума (PRNU) и аномалий в распределении шума каналов.
* **Происхождение контента (`I-01`):**
  * Спецификации коалиции **[C2PA (Coalition for Content Provenance and Authenticity)](https://c2pa.org/)** : AI-Finder обнаруживает манифест (JUMBF в JPEG, чанк `caBX` в PNG, `C2PA` в WebP) и читает заявленные издателя и `digitalSourceType`. Криптографическая подпись не проверяется.
* **Метаданные документов (`D-01` – `D-03`):**
  * Спецификация **ISO/IEC 29500 (OOXML)**: анализ тегов `w:rsidR` (сессии редактирования), `TotalTime` в `docProps/app.xml`, а также параметров PDF-producer. Отсутствие сессий правок при большом объеме текста указывает на одновременную вставку из буфера обмена.
