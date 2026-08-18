// English locale. `content.html` is the Korean source of truth for structure;
// this file supplies the English copy that the build overlays onto it.
//
// Keys in `topics` must match the `<section id="...">` values in content.html —
// build.mjs fails if one is missing or unknown. Equations are not duplicated
// here: they are carried over from the source markup, and `{{formula}}` marks
// where each one lands inside a body.
export default {
  lang: 'en',
  output: 'index.html',
  // Nothing Korean may survive into this page.
  forbid: '[가-힣]+',
  title: 'Self-Supervised Learning and Collapse — Blog',
  description:
    'From building a learning problem out of unlabeled data to the conditions that produce representation collapse, the collapse types that live at different units of observation, and how to diagnose them. Compares the guardrails of SimCLR, BYOL, DINO, VICReg and I-JEPA as five design patterns, and closes with the gap between global and patch-level representations.',

  // Fills the <h1> and the first index-nav entry.
  heading: 'Self-Supervised Learning and Collapse',
  languageLink: '<a class="language-link" href="./ko.html" lang="ko">Korean ver.</a>',

  navLabel: 'Topics in this article',

  // Replaces everything between the intro:start / intro:end markers.
  intro: String.raw`
      <p class="la-sub">
        The internet overflows with images, video and audio, but data where a person has written down the objects, scenes and sounds inside them is scarce. Self-supervised learning starts from this gap. Instead of people attaching answers, it builds a learning problem out of the data itself and has the model learn a usable representation by solving it.
      </p>
      <p class="la-sub">
        There are many ways to pose the problem. You can restore masked pixels or waveforms, or match the representations of two pieces cut from the same image, video or audio clip. On the surface these look like similar pretraining, but the two problems differ in kind. Pixels and waveforms stay where they are no matter what the model does; representations move together with the model.
      </p>
      <p class="la-sub">
        Making a moving representation the answer opens an unexpected shortcut. Send every input to the same vector and the two representations always agree. The loss is low, but no information remains. <strong>This phenomenon is called representation collapse</strong>.
      </p>
      <p class="la-sub">
        That said, "just keep it from collapsing" is not the answer either. This article treats self-supervised learning as the problem of deciding what to preserve and what to compress between an input view and a target view. The two views here do not only mean two augmented images: the corrupted input → clean target of reconstruction methods is also two roles played by the same data: two views. Collapse-prevention devices do not protect all information. They only keep the compression from ending in the trivial solution that sends every input to the same value. So when the level at which the constraint is computed and the level the downstream task demands diverge, local information can vanish while the global representation looks perfectly fine.
      </p>
      <p class="la-sub">
        The order is this. First we separate which learning problems open the shortcut, then survey the different types of collapse and how to diagnose them. Next we compare what methods like SimCLR, BYOL, DINO and VICReg tried to preserve. At the end we return to a less visible failure: per-image representations can be fine while per-patch structure disappears.
      </p>
      <p class="la-sub">
        One scoping note up front. The collapse types collected here are not an exclusive classification but a map of failures with <em>different units of observation</em>, and the five prevention devices are not a census but the <em>design patterns</em> this article compares.
      </p>`,

  topics: {
    why: {
      title: 'What is Self-Supervised Learning?',
      lead: 'Learning from the data itself, without human labels.',
      body: String.raw`<p class="interp">In supervised learning we show an image together with a label a person wrote. Answer "car" on a cat photo and you are wrong. A model that gives every image the same answer also loses on most samples. The external answer holds the model in place.</p>
<p class="interp">Unlabeled data has no such answer sheet. That does not mean it has no learning signal. You can mask part of an image and have the model recover the original pixels, or transform one image twice and have it recognize that both came from the same image. Temporally adjacent video frames, or the next word of a sentence, also serve as answers. Nobody wrote the answers down; the structure inside the data provides the supervision. This is the basic idea of self-supervised learning (SSL).</p>
<p class="interp">SSL methods answer two big questions. First, <em>what to predict?</em> It can be an observed value like pixels or tokens, or the latent representation of another view. Second, <em>what information must be the same across the two views?</em> Object identity should survive crops and color changes, but the exact background color may not need to. A good pretext task fixes what to discard and what to keep through these two choices.</p>
<p class="interp">This is also why matching representations directly is attractive. Pixel reconstruction can spend capacity explaining the grain of grass or sensor noise. In representation space, by contrast, there is room to drop details judged unnecessary for downstream tasks. SimCLR, BYOL, DINO, VICReg and I-JEPA differ in implementation but all exploit this possibility.</p>
<p class="interp">But when the model also makes the answer, the external fixed point disappears. Call the two views from one image \(x_1,x_2\) and the encoder \(f_\theta\), and suppose we only shrink the distance between the two representations.</p>
{{formula}}
<p class="interp">The solution we want puts cats near cats and apart from cars. But looking at this objective alone, there is an easier solution. Set \(f_\theta(x)=c\) regardless of input and the two terms always agree; the loss is 0. The training problem is solved, and not one bit of information about the data remains.</p>
<p class="definition">This constant solution is called a trivial solution, and the phenomenon of the learned representation heading toward that solution or a similar low-dimensional state is called representation collapse. That a constant solution <em>exists</em> in the objective, that optimization actually <em>reaches</em> it, and that downstream performance is <em>poor</em> are not the same sentence. From here on we keep the three apart.</p>
<p class="interp">Of course, real methods do not use only the distance term above. SimCLR has negative samples, BYOL has stop-gradient, VICReg has a variance term. Some methods remove the trivial solution from the objective; others leave it in place and keep optimization from flowing there. Understanding collapse means asking what information these extra devices preserve.</p>
<p class="hint">In this article the name of an SSL algorithm is not the starting point. We look first at what target it builds, and which collapse it prevents at which level.</p>`,
    },

    when: {
      title: 'When Does Collapse Occur?',
      lead: 'The form collapse takes depends on whether the target is fixed or moves together with the model.',
      body: String.raw`<p class="definition"><strong>Here the target is the answer \(y_i\) the model must hit.</strong> The data point \(x_i\) is the input, and the target \(y_i\) is the answer paired with that input. This section splits targets into raw observations, fixed cluster indices, learned cluster indices, fixed latents and learned latents. When a cluster method uses soft assignments, the target is a probability distribution over several clusters rather than a single index.</p>
<p class="interp">Consider predicting the pixel values of a masked region. If the model outputs the same color at every position, it cannot match the different original pixels. Pixels do not turn into a constant alongside the model during training, so the joint-embedding shortcut of both branches going to the same constant to zero the loss is closed. Non-constant targets made by a fixed tokenizer's codes or a frozen encoder anchor the problem for the same reason. Of course, in the extreme where the context gives no information about the target, a constant prediction like the mean can be optimal. What is ruled out here is strictly <em>zero-loss joint collapse</em>.</p>
<table class="cmp labeled">
  <thead><tr><th>Target \(y_i\)</th><th>State during training</th><th>Can a constant output reach loss 0?</th></tr></thead>
  <tbody>
    <tr>
      <td>Raw pixels · waveform <span class="sub">(MAE's pixels)</span></td>
      <td>fixed</td>
      <td>Impossible (the answer differs per sample and position)</td>
    </tr>
    <tr>
      <td>Fixed cluster index <span class="sub">(the code indices of BEiT · BEST-RQ)</span></td>
      <td>fixed</td>
      <td>Impossible (provided distinct indices are actually in use)</td>
    </tr>
    <tr>
      <td>Learned cluster index <span class="sub">(SwAV's assignments, DINO's prototype distribution)</span></td>
      <td>learned</td>
      <td>Possible (everyone can pick the same cluster)</td>
    </tr>
    <tr>
      <td>Fixed latent <span class="sub">\(h_{\bar\phi}(x_i)\), a frozen encoder's output</span></td>
      <td>fixed</td>
      <td>Impossible (provided latents differ per sample)</td>
    </tr>
    <tr>
      <td>Learned latent <span class="sub">\(h_\xi(x_i^{(2)})\), the other view encoder's output</span></td>
      <td>learned</td>
      <td>Possible (the two branches can become the same constant)</td>
    </tr>
  </tbody>
</table>
<p class="interp">Reading the last column as "no prevention device needed" goes too far. What a fixed target rules out is <em>a constant output for this matching loss</em>. A strong decoder or a bypass path can leave the encoder underused, and a learned tokenizer or codebook can end up using only some codes. Representations sufficient for reconstruction but insufficient for semantic tasks, and overly local shortcuts, remain possible.</p>
<p class="interp">Conversely, if the target encoder is trained as well, the target itself can turn into a constant. The predictor and the target move together, so the moment the two agree on the same constant the matching loss vanishes. This is where collapse appears as a problem of the objective.</p>
<p class="interp">The reason to use learned representations as targets anyway is that you need not explain every pixel-level uncertainty. The exact position of leaves or the texture of grass is hard to predict from one crop, and may be unnecessary for a semantic representation. This is the background against which <a href="https://openreview.net/forum?id=BZ5a1r-kVsf" target="_blank" rel="noopener">JEPA</a> proposes predicting in representation space instead of pixels. The advantage of being able to discard information selectively, and the risk of being able to discard all of it, come from the same design.</p>
<p class="interp"><a href="https://arxiv.org/abs/2111.06377" target="_blank" rel="noopener">MAE</a> predicts pixels, <a href="https://arxiv.org/abs/2106.08254" target="_blank" rel="noopener">BEiT</a> the discrete tokens a tokenizer made, and <a href="https://arxiv.org/abs/2202.01855" target="_blank" rel="noopener">BEST-RQ</a> the indices of a fixed random codebook. These targets do not move to a constant together with the encoder being trained. So the devices against the <em>joint collapse onto a constant target</em> described in this section are unnecessary. That does not mean these methods are free of other failures such as information bottlenecks or low-quality representations.</p>
<p class="interp">In the language of information theory, the moment you make two views one assumption enters: the information shared by the two views is sufficient for later tasks, and information left in only one view may be discarded. <a href="https://arxiv.org/abs/2304.09355" target="_blank" rel="noopener">Shwartz-Ziv and LeCun's (2023) review</a> calls this the Multiview assumption and writes it as the condition that \(I(Y;X_2\mid X_1)\) and \(I(Y;X_1\mid X_2)\) are both small for the task \(Y\). That is, <em>either view alone carries almost all the information the task needs</em>. When the assumption holds, compressing view-specific detail can be desirable invariance.</p>
<p class="interp">The same review covers when the assumption breaks. If crops or color transforms change the label, or several downstream tasks demand different information, task-relevant information also sits in the unshared part. Compression then makes the representation insufficient without any complete collapse. <strong>So neither "compression = collapse" nor "a widely spread representation = a good representation".</strong> This is why collapse metrics and downstream performance stay separate to the very end of this article.</p>
<p class="interp">In the end, "how much compression is right" has no task-independent answer. The extreme that erases all information is clearly to be avoided, but how much non-shared information to keep is decided by the relation between the augmentations and the downstream task.</p>
{{formula}}
<p class="hint"><strong>Press play and the same initial model outputs</strong> train under the two objectives. On the left, each sample follows a different fixed target, so the outputs cannot all be pushed into one point. On the right, among the many solutions the bare matching loss admits, the shared encoder's scale shrinks and the two views ride together toward the constant solution, <em>one possible collapse path</em>. It does not mean this loss always takes that path.</p>`,
    },

    taxonomy: {
      title: 'Types of Collapse and Related Failures',
      lead: 'Six failures with different units of observation, collected in one place for comparison.',
      body: String.raw`<p class="definition">Two words first. Modern models do not look at an image whole; they cut it into small patches. Each patch maps to one vector, and that vector is called a token. One image becomes tens to hundreds of tokens, and averaging them gives one vector that summarizes the image. Call it the pooled vector. The "level" in the table below says whether a row is a story <em>between images</em> or <em>inside one image</em>.</p>
<table class="cmp labeled">
  <thead><tr><th>Name</th><th>What collapses</th><th>Unit of observation</th><th>Diagnostic statistic</th><th>Applicable models</th></tr></thead>
  <tbody>
    <tr><td>complete collapse</td><td>every image becomes the same vector</td><td>sample</td><td>per-dimension standard deviation</td><td>joint-embedding methods broadly</td></tr>
    <tr><td>dimensional collapse</td><td>representations confined to a low-dimensional subspace (512 dimensions on paper, three in actual use)</td><td>embedding dimensions</td><td>eigenvalue spectrum · effective rank</td><td>joint-embedding methods broadly</td></tr>
    <tr><td>covariance redundancy<br><span class="sub">VICReg's "informational collapse"</span></td><td>dimensions repeat what other dimensions say</td><td>pairs of dimensions</td><td>off-diagonal RMS of the correlation matrix</td><td>joint-embedding methods broadly</td></tr>
    <tr><td>mode collapse</td><td>only a few of the prepared prototypes keep being used</td><td>prototype · code</td><td>usage perplexity</td><td>only methods with a prototype head or codebook</td></tr>
    <tr class="hi"><td>token collapse<br><span class="sub">related: rank loss · over-smoothing</span></td><td>the patches within one image grow alike, or get confined to a low-dimensional subspace</td><td>tokens within one sample</td><td>token Gram spectrum · pairwise similarity</td><td>any encoder that emits tokens <span class="sub">(SSL or supervised)</span></td></tr>
    <tr class="hi"><td>local structure lost</td><td>near and far patches become indistinguishable<br><span class="sub">(strictly speaking not a collapse. See below)</span></td><td>tokens + positions within one sample</td><td>contrast gap · position probe</td><td>objectives with no per-position condition, or that reach only some positions</td></tr>
  </tbody>
</table>
<p class="definition">The third row is renamed. <a href="https://arxiv.org/abs/2105.04906" target="_blank" rel="noopener">Bardes et al.'s VICReg</a> calls the state where axes move together <em>informational collapse</em>, but this article uses the narrower term <strong>covariance redundancy</strong>. The fact that the correlation matrix's off-diagonals are zero cannot by itself certify that the information a downstream task needs has survived.</p>
<p class="interp">Most names come from the literature. <a href="https://arxiv.org/abs/2105.00470" target="_blank" rel="noopener">Hua et al. (2021)</a> split the first two apart, pointing out that dimensional collapse is a distinct and often-overlooked state, and <a href="https://arxiv.org/abs/2110.09348" target="_blank" rel="noopener">Jing et al. (2022)</a> showed it occurs even in contrastive methods. The bottom two rows have names outside SSL as well: transformer rank collapse (<a href="https://arxiv.org/abs/2103.03404" target="_blank" rel="noopener">Dong et al., 2021</a>) and over-smoothing in deep ViTs. One more phenomenon, slightly different in kind, belongs alongside: the report of artifact tokens, low-information patches recycled as slots that gather global information (<a href="https://arxiv.org/abs/2309.16588" target="_blank" rel="noopener">Darcet et al., 2023</a>). V-JEPA 2.1's diagnosis, seen later, has exactly this shape.</p>
<p class="interp">A caution here. Patches growing alike can happen <em>regardless of the objective</em>. There is a story that stacking attention deeply does this on its own. But do not inflate the evidence: <a href="https://arxiv.org/abs/2103.03404" target="_blank" rel="noopener">Dong et al.</a>'s theorem is about pure attention with no skip connections and no MLPs, and the paper's own conclusion is rather that <em>"skip connections play a key role in mitigating rank collapse"</em>. A real ViT is not the case the theorem covers. Still, there are separate reports that patch representations grow alike in deep <em>supervised</em> ViTs (<a href="https://arxiv.org/abs/2104.12753" target="_blank" rel="noopener">Gong et al., 2021</a>; <a href="https://arxiv.org/abs/2103.11886" target="_blank" rel="noopener">DeepViT</a>). So the discussion below can claim only "observed under SSL objectives", not "caused by SSL objectives".</p>
<p class="interp">The six rows overlap, and they are not even concepts on the same level. Dimensional collapse (fewer dimensions in use) and covariance redundancy (dimensions saying the same thing) are usually two descriptions of one event. Mode collapse is a failure of the <em>head that picks prototypes</em>, not of the representation itself, so it is not even defined for VICReg or BYOL, which have no such head. Local structure lost is, strictly, not a collapse. Patches can stay plenty distinct while only their tie to position blurs. They still share one table because <em>the places to hang diagnostics are the same</em>, not because they are the same kind of failure.</p>
<p class="interp">Two things to remember in practice. Complete collapse tends to reveal itself readily in modern recipes and can be caught quickly with unnormalized per-dimension standard deviations (the measurement pitfalls come in the next section). Partial dimension loss and local structure loss are much quieter. Also, the top four rows look <em>between</em> images while the bottom two look <em>inside</em> one image. The patches within an image can grow alike while per-image pooled vectors stay distinct, so watching only the upper metrics can miss this failure.</p>
<p class="interp">The symptom "the dense features are weak" is usually the bottom two rows. Dense features here are representations for tasks that need <em>one vector per position</em> rather than one per image: segmentation, depth estimation, per-frame prediction. Watch classification accuracy alone and this failure stays invisible to the end.</p>
<p class="hint">The figure below compares only the typical shapes of the six states. The two warm-tinted panels are the within-image stories (the same two rows highlighted in the table), and the other four are between-image stories. Real high-dimensional representations are more complicated than a 2-D drawing, so treat this as a concept map, not a diagnostic standard.</p>
<figure class="taxonomy-static">
  <img src="./collapse-types.en.svg" alt="A six-panel diagram in two rows of three comparing complete collapse, dimensional collapse, covariance redundancy, mode collapse, token collapse and local structure lost. Each panel names the unit of observation, the diagnostic statistic and the applicable models, and the two within-image failures are tinted with a warm background" width="960" height="644">
  <figcaption class="figure-caption">One dot is an image representation; one grid cell is a patch token. Color marks mutually distinguishable information or positional structure. Only the two warm-tinted panels (token collapse · local structure lost) are statistics measured inside one image.</figcaption>
</figure>`,
    },

    metrics: {
      title: 'Measuring Collapse',
      lead: 'Metrics for noticing, during training, which kind of collapse is under way.',
      body: String.raw`<p class="definition">Separate two questions first. 1) <em>Has the representation collapsed to a trivial or low-dimensional state?</em> 2) <em>Does the information the downstream task needs remain?</em> Every metric below serves question 1), which is why they can be measured during training without labels. Question 2) is different. As the Multiview assumption of <a href="#when">the earlier When Does Collapse Occur? section</a> says, "what counts as needed information" is decided by the task, so no answer comes without a task, a probe or explicit assumptions. Try to answer both questions with one metric and the misunderstanding that <strong>spread-out means good</strong> begins. Noise or a position code alone can push rank up just fine.</p>
<p class="definition">Three terms, unpacked in advance. Effective rank counts "how many of the 512 dimensions are actually in use" (normalize the covariance eigenvalue spectrum, summarize it with entropy, exponentiate). The Gram matrix is the full table of how alike the patches within one image are. When patches clump, this table's rank drops. Perplexity counts "how many of the prepared prototypes are effectively in use".</p>
<table class="cmp">
  <thead><tr><th>What it measures</th><th>Target</th><th>Failure caught</th></tr></thead>
  <tbody>
    <tr><td>median and bottom 5% of per-dimension standard deviations</td><td>pooled</td><td>complete collapse <span class="sub">(depends on how you measure. See below)</span></td></tr>
    <tr><td>effective rank and the eigenvalue spectrum</td><td>pooled</td><td>dimensional collapse</td></tr>
    <tr><td>RMS of the correlation matrix minus its diagonal</td><td>pooled</td><td>covariance redundancy</td></tr>
    <tr><td>mean and coefficient of variation of vector norms</td><td>pooled</td><td>norms exploding or vanishing</td></tr>
    <tr><td>how evenly things are spread (uniformity)</td><td>pooled</td><td>not one point, but crowded into a corner</td></tr>
    <tr class="hi"><td>token Gram rank</td><td>token</td><td>token collapse <span class="sub">(unlike mean cosine it is not fooled by sign, though a position code alone can raise it)</span></td></tr>
    <tr class="hi"><td>mean and top 5% of patch-pairwise cosine</td><td>token</td><td>token collapse <span class="sub">(the mean alone misses it. See below)</span></td></tr>
    <tr class="hi"><td>contrast gap: the similarity difference between adjacent and distant patches</td><td>token</td><td>local structure lost</td></tr>
    <tr class="hi"><td>position probe: predict which grid cell a patch came from, given only its vector</td><td>token</td><td>local structure lost</td></tr>
    <tr class="hi"><td>within-image variance ÷ between-image variance</td><td>both</td><td>whether the two levels have diverged at all</td></tr>
    <tr><td>standard deviation and drift of teacher outputs</td><td>slowly trailing target</td><td>the target side collapsing first</td></tr>
    <tr><td>prototype usage frequency and perplexity</td><td>prototype head or codebook</td><td>mode collapse</td></tr>
  </tbody>
</table>
<p class="interp">Standard deviation says different things depending on where you measure it. Measured after normalizing vectors to unit length, you see only <em>direction</em> and miss the collapse where whole vectors shrink. Measured without normalization you see length too, but scales differ across methods and comparisons get hard. Keep both, and read how far things have collapsed from the rank side.</p>
<p class="interp">The trap in dividing effective rank by 512: when the batch size \(n\) is smaller than the dimension \(d\), the number of eigenvalues that can even be nonzero is capped at \(\min(n-1,d)\). Even a perfectly spread representation tops out at \((n-1)/d<1\). Read against 1 only when \(n \ge d\); otherwise compare only runs with equal batch sizes.</p>
<p class="interp">Mean patch cosine is fooled by sign. Imagine patches lying on a single axis with mixed signs: half at \(+v\), half at \(-v\). Every pair's cosine is +1 or −1, so the mean sits near 0. Looks very healthy. Yet the patches all lie on one 1-D line and the Gram rank is on the floor. Already collapsed, and the mean tells you nothing. So the default metric should be Gram rank, and any cosine reading must come <em>together with an upper percentile</em> (in the case above the top 5% is pinned at 1).</p>
<p class="interp">Gram rank is no cure-all either. Patches can all differ while their differences are shuffled <em>independently of position</em>: Gram rank high, yet the distinction between "top-left and bottom-right" already gone. Hence two position-aware metrics: the similarity difference between adjacent and distant patches (the contrast gap), and predicting which grid cell a patch came from given only its vector.</p>
<p class="interp">The position probe has one big trap, though. A ViT adds positional information at the input stage, so position survives partly <em>for free</em>. Even a thoroughly collapsed model can score high on it. What this metric measures is not dense performance but "does the patch still remember where it was". Do not read absolute values as performance; read differences between matched conditions, and read whole curves, not single points.</p>
<p class="interp">Do not fix thresholds in advance. Embedding scales themselves differ by method, so there is no universal "danger below 0.3". It is right to raise alarms on sharp drops or spikes relative to the early stable stretch of training. If it collapses from the very start there is no stable stretch. Use the value measured at random initialization, before training, as the baseline.</p>
<p class="interp">The act of measuring must not change training. Never add these to any loss, of course, and do not use them for learning-rate control or best-checkpoint selection either. Compute them without gradients, and do not run them inside the training forward at every step. Run an SVD per step and training speed differs per condition. Finally, use a separate random stream: draining the randomness used for data order and masking breaks reproducibility.</p>
<p class="interp">Finally, back to the two questions of the first paragraph. All the metrics above are tools for question 1). A high Gram rank does not make segmentation work. Not having collapsed is a necessary condition of a usable representation, not a sufficient one. <a href="https://arxiv.org/abs/2209.15007" target="_blank" rel="noopener">Li, Efros, Pathak (2022)</a> faced this gap head-on, reporting that under partial collapse the metrics and the performance do not move in step.</p>
<p class="interp">To measure question 2) you need the task-side tools after all: a linear probe, k-NN, and, if dense is the worry, a segmentation probe on frozen features. These three can also disagree; a pretraining can win at linear probing and lose at fine-tuning, a rank reversal. So in practice it is safest to watch <em>the collapse metrics and the task probes together</em>.</p>`,
    },

    negatives: {
      title: '1. Negative Samples',
      lead: 'Writing the condition "must differ from the other photos" directly into the loss.',
      body: String.raw`<p class="definition">The five sections from here are five "design patterns". Not a census, and not mutually exclusive. Real methods usually stack several devices. DINO uses stop-gradient/EMA together with centering–sharpening, and DINOv2 adds iBOT and KoLeo on top. Even methods placed in the same cell do not work identically (Barlow Twins and VICReg, for one). <strong>The criterion for cutting five was "each represents a different kind of answer", not completeness of classification.</strong> <a href="#grid">The later table</a> counts at least two more devices that fit none of the five.</p>
<p class="definition">Each of the five sections carries the device's pseudocode alongside. The way to read it is to <strong>look at the tensor shapes first</strong>. What an encoder emits is always patch tokens \((N,P,d)\), and Algorithms 1–7 all fold that \(P\) axis with pooling before applying a loss. If \(P\) appears nowhere in the loss, the device is applied to the <em>pooled embedding</em> and never looks at what happens inside one image. Only Algorithms 8–10, placed in <a href="#level">the later token-level section</a>, keep \(P\) to the end. Laying the two groups side by side is the shortest definition of the <em>level</em> this article talks about.</p>
<p class="interp">The idea is simple. Two views of the same photo <em>pull</em> together, and <em>push</em> against the other photos in the batch. The moment everything tries to head to one vector, the pushing force works against it, so the cheating answer costs from the start. The InfoNCE that <a href="https://arxiv.org/abs/1807.03748" target="_blank" rel="noopener">CPC</a> introduced has this form, and <a href="https://arxiv.org/abs/2002.05709" target="_blank" rel="noopener">SimCLR</a> and <a href="https://arxiv.org/abs/1911.05722" target="_blank" rel="noopener">MoCo</a> made it a major success on images.</p>
{{formula}}
<p class="definition">How to read the equation. The numerator is the similarity to <em>the other view of the same photo</em>, the pulling force. The denominator is the sum of similarities to <em>every photo in the batch</em>, the pushing force. \(\tau\) (temperature) is the knob deciding whether to push hardest on only the nearest neighbors or push everything evenly but weakly. If everything clumps at one point, all terms in numerator and denominator become equal and the loss pins to the constant \(\log(2N-1)\), which is not the floor.</p>
<p class="interp">Why this works has been explained rather cleanly. <a href="https://arxiv.org/abs/2005.10242" target="_blank" rel="noopener">Wang &amp; Isola (2020)</a> decomposed this loss into two terms. Alignment says "two views of one photo should be close"; uniformity says "representations should spread evenly over the sphere". With alignment alone everything gathers at a point; the part that prevents collapse is uniformity. But <strong>remember the scope in which the decomposition holds</strong>. It is an analysis of the InfoNCE form with \(\ell_2\)-normalized embeddings placed on the sphere. "What negatives do is exactly uniformity" must not be generalized to every negative-based objective.</p>
<p class="interp">Still, the decomposition works as a lens for reading the other four. The devices to come also keep representations from crowding into one place; what changes is <em>what gets spread evenly</em>: distance on the sphere here, and later per-dimension variance, the shape of the embedding distribution, and prototype usage frequency.</p>
<p class="interp">The basic in-batch implementation often benefits from more negatives; SimCLR itself compared batches grown from 256 to 8192. But a large batch is not a requirement of every contrastive method. Use a queue like MoCo and the negative count decouples from the batch size. And a batch also contains photos of genuinely the same kind, giving the false-negative problem of forcing two cat photos apart.</p>
<p class="interp">MoCo's workaround comes from here. It makes one encoder the EMA (exponential moving average, a slowly trailing copy) of the other and stacks past batches' vectors in a queue, detaching the negative count from the batch size. Here the EMA is not a collapse-prevention device. The blocking is done by the negatives, and the EMA keeps the old vectors piled in the queue mutually consistent. Indeed, set the momentum to 0 and training fails to converge, not because the negatives vanish, but because the target changes abruptly every step and the queue becomes meaningless. Its role is completely different from the EMA of the next section.</p>
<p class="interp">Where it acts: between the images in a batch. That is the base form, though. Where the pushed-against samples come from can change. wav2vec 2.0 draws them from within the same utterance, moving the same device inside one sample.</p>`,
    },

    stopgrad: {
      title: '2. Stop-Gradient and Asymmetry',
      lead: 'Making the gradient path asymmetric instead of changing the loss.',
      body: String.raw`<p class="definition">This section has to open with its limits. The devices here do not <em>erase</em> the constant solution from the objective. Send every input to the same vector and the loss is still exactly 0, and if the target is already constant, nothing in the loss keeps the student from following it there. So read what follows as being about <strong>a device that breaks the left–right symmetry of the gradients, not a sufficient condition</strong>, for preventing collapse. Why BYOL and SimSiam do not actually collapse is the tangled result of the predictor, normalization, optimization dynamics and initialization, and has not yet been settled in one sentence.</p>
<p class="interp">With that line drawn, the analogy: when two parties try to match each other, the gradients are left–right symmetric and "both stand still" is the cheapest agreement. Cut the gradient on one path and that symmetry breaks. This is what <a href="https://arxiv.org/abs/2006.07733" target="_blank" rel="noopener">BYOL</a> and <a href="https://arxiv.org/abs/2011.10566" target="_blank" rel="noopener">SimSiam</a> do.</p>
<p class="definition">Three parts usually appear together. Stop-gradient keeps the target path from being updated directly by gradients. The predictor attaches a small network to the student side only, making the two paths different. Methods using EMA update the target network as a slow average of the student parameters. <a href="https://arxiv.org/abs/2301.08243" target="_blank" rel="noopener">I-JEPA</a> and <a href="https://arxiv.org/abs/2404.08471" target="_blank" rel="noopener">V-JEPA</a> use all three. <a href="https://arxiv.org/abs/2104.14294" target="_blank" rel="noopener">DINO</a> has no separate predictor, and in <a href="https://arxiv.org/abs/2202.03555" target="_blank" rel="noopener">data2vec</a> the student, processing masked input, directly predicts the representation of a full-input teacher.</p>
{{formula}}
<p class="interp">SimSiam showed that, at least in its recipe, training works with stop-gradient and a predictor alone, without EMA. That result means asymmetry is an important clue, not that EMA is mere decoration in BYOL, DINO and JEPA. DINO in fact collapses in the ablation that removes the momentum teacher.</p>
<p class="interp">That what blocks collapse is the path training flows along, not the loss, is more than a figure of speech. <a href="https://arxiv.org/abs/2102.06810" target="_blank" rel="noopener">Tian, Chen, Ganguli (2021)</a> linearized these dynamics and showed that with a predictor and stop-gradient the directions heading toward the constant get suppressed. But this analysis, too, is a result on a linearized model.</p>
<p class="interp">So <em>why it is sufficient</em> is still being debated. Famous is <a href="https://imbue.com/research/2020-08-24-understanding-self-supervised-contrastive-learning/" target="_blank" rel="noopener">Fetterman &amp; Albrecht's (2020)</a> reading that batch normalization inside the predictor secretly plays the role of negatives, which <a href="https://arxiv.org/abs/2010.10241" target="_blank" rel="noopener">Richemond et al. (2020)</a> rebutted by showing BYOL runs fine with normalization that uses no batch statistics. No conclusion yet.</p>
<p class="interp">In implementation, reproduce the paper's normalization and teacher state exactly. Drop the output normalization and a bypass can open that lowers the distance loss by shrinking the representation's scale. There is no universal rule to keep the teacher in <code>eval()</code>, though. How batch normalization's running statistics and dropout are handled differs by method and official implementation, so do not treat cutting gradients and the train/eval mode as the same setting.</p>
<p class="interp">A caution when comparing strength. For other methods you double a coefficient; here "applying it harder" means moving momentum from 0.99 to 0.999. The axis is entirely different. And having no coefficient does not mean having no tuning. The momentum and its warm-up, the predictor's size and depth, and the target normalization scheme are all real knobs.</p>
<p class="interp">Where it acts: everywhere, but implicitly. With no term in the loss, you cannot read from the equation where the force lands. What it blocks is <em>all inputs becoming the same</em>, and the unit at which that statistic is computed is decided not by this device but by the matching loss it rides on. Put it on pooled vectors as BYOL does and it touches only relations between images; put it on a per-patch loss as I-JEPA does and it reaches the patch level too.</p>`,
    },

    dino: {
      title: '3. Centering and Sharpening',
      lead: 'Preventing collapse by balancing two forces that push in opposite directions.',
      body: String.raw`<p class="interp">The picture first. <a href="https://arxiv.org/abs/2104.14294" target="_blank" rel="noopener">DINO</a> does not compare representations directly; it converts them into a probability distribution over \(K\) prepared prototypes, like "this photo looks like entry 3". The two views are then trained to pick <em>the same entry</em>. That can break in two ways. Everyone picks only entry 3, or nobody makes a decision and every entry gets the same probability.</p>
<p class="definition">So two forces are applied. Centering subtracts the batch mean from the teacher's outputs so no single entry can run away with everything. Sharpening lowers the temperature to make the distribution peaky, a push to "make a decision". One pushes toward using entries evenly, the other toward deciding firmly.</p>
{{formula}}
<p class="interp">The paper's own summary is the same. Centering prevents one entry from dominating but pushes toward the uniform distribution; sharpening pushes in exactly the opposite direction. Applied together, the effects cancel and collapse is avoided. But the attached qualifier must not be dropped: in the paper's words, <em>"sufficient to avoid collapse in presence of a momentum teacher"</em>. <strong>The balance is sufficient on the premise that an EMA teacher is present.</strong></p>
<p class="interp">The temperature goes <em>up</em>. DINO fixes the student's \(\tau_s=0.1\) and raises the teacher's \(\tau_t\) from 0.04 to 0.07 over the first 30 epochs. This passage is often quoted in the opposite direction. The appendix's report goes like this: above \(\tau_t=0.06\) the training loss converges to \(\ln K\), but <em>starting from a small value and raising it over the first few epochs</em> keeps even higher values from collapsing. A loss going to \(\ln K\) means collapse to the state that gives every entry the same probability. So the dangerous side here is <em>high</em> temperature, and the warm-up is the ladder for using that range safely. But the number 0.06 and the direction "high → uniform collapse" are observations under DINO's schedule, architecture and teacher setup. Change the prototype count or the teacher configuration and the same value does not mean the same thing.</p>
<p class="interp">The centering slot is swappable, and in fact older than DINO. The role "even out entry usage within a batch" starts with <a href="https://arxiv.org/abs/1911.05371" target="_blank" rel="noopener">SeLa</a>'s (2020) equipartition constraint. Cast the label assignment as an optimal transport problem and force an even split. <a href="https://arxiv.org/abs/2006.09882" target="_blank" rel="noopener">SwAV</a> moved that to soft Sinkhorn-Knopp assignments on minibatches, DINO's centering is a <em>much lighter</em> implementation of the same role, and <a href="https://arxiv.org/abs/2304.07193" target="_blank" rel="noopener">DINOv2</a> goes back to Sinkhorn-Knopp. "Centering" is best read as the name of a role, not of one implementation.</p>
<p class="interp">Trade-offs. Blocking the two failures each explicitly makes the diagnosis crisp (you can see which one blew up), and "entry usage frequency" comes free as a directly visible metric. In exchange, this has the most places to touch: two temperatures, the center momentum, the warm-up schedule. When the balance tips, it goes over in one of the two directions.</p>
<p class="interp">Where it acts: batch statistics + the distribution. The center is a batch mean, so this is plainly a between-images story.</p>
<p class="hint">The simulation pushes 64 photos through the teacher. The two forces show up in <em>different numbers</em>, so both are displayed. Turn centering off and everyone picks the same entry, and perplexity falls to 1. Turn sharpening off and entry usage is perfectly even while the <em>per-photo entropy</em> pins at its maximum: using everything evenly while distinguishing nothing.</p>`,
    },

    vicreg: {
      title: '4. Variance and Covariance',
      lead: 'Writing variance and covariance conditions directly into the loss.',
      body: String.raw`<p class="interp">If the previous two are indirect, this is the frontal assault. Collapse, in the end, means "the representation is not spread out", so write "be spread out" directly into the loss. <a href="https://arxiv.org/abs/2105.04906" target="_blank" rel="noopener">VICReg</a> does exactly that.</p>
<p class="definition">Three terms. Invariance keeps the two views close. Variance requires each dimension's standard deviation to be at least \(\gamma=1\) (penalty if it falls short). Covariance keeps the dimensions from repeating each other. The coefficients are 25 / 25 / 1.</p>
{{formula}}
<p class="interp">The variance term rules out the constant solution directly. If all representations become equal, the standard deviation hits 0 and each dimension keeps a positive penalty of \(\max(0,\gamma-0)=\gamma\). The covariance term reduces the state where axes keep repeating each other. But pushing the off-diagonals to 0 is a constraint on the <em>covariance structure</em>, not a guarantee that the representation carries the information the task needs. Thanks to these two terms, VICReg trains with a symmetric architecture: no EMA, no stop-gradient, no negatives.</p>
<p class="interp">Barlow Twins looks similar but handles variance differently. <a href="https://arxiv.org/abs/2103.03230" target="_blank" rel="noopener">Barlow Twins</a> builds the cross-correlation matrix of two batch-standardized views and pushes the diagonal to 1 and the off-diagonal to 0. Under constant output the standardization itself degenerates and the diagonal cannot reach 1. So rather than crediting collapse prevention to the normalization alone or to the diagonal loss alone, it is more accurate to see it as a property of <em>the whole cross-correlation objective with standardization included</em>. VICReg makes the role more explicit by exposing the minimum standard deviation as its own loss term.</p>
<p class="interp">A precedent already moves the same criterion one level down. <a href="https://arxiv.org/abs/2210.01571" target="_blank" rel="noopener">VICRegL</a> (2022) applies the three terms not only to whole-image vectors but to local features paired across the two views. Do not forget this precedent when <a href="#level">the later discussion moves global criteria to the patch level</a>.</p>
<p class="interp">KoLeo looks similar but its emphasis differs. <a href="https://arxiv.org/abs/2304.07193" target="_blank" rel="noopener">DINOv2</a> widens, in normalized embeddings, each sample's <em>distance to its nearest neighbor</em> (\(-\frac1n\sum\log d_i\)). If everything gathers at one point the distances become 0 and this value diverges, so functionally it rules out complete collapse. In DINOv2's ablation, removing KoLeo drops Oxford-M retrieval from 63.9 to 55.6 while ImageNet-1k classification moves 85.8 → 85.3 and ADE20k segmentation 47.1 → 47.2, barely at all. This alone cannot support the conclusion that KoLeo plays no anti-collapse role: the measurement was taken inside a recipe that already carries other devices. Where the variance term demands a per-dimension variance floor, KoLeo directly widens sample-to-sample proximity on the unit sphere.</p>
<p class="interp">The multi-GPU trap. Compute variance and covariance separately per GPU and the "batch statistics" are really one GPU's statistics. Change the GPU count and you change the device's strength. Gather the batch with a gradient-passing all-gather and it behaves as designed. The same problem exists for the batch norm inside the predictor back in <a href="#stopgrad">the stop-gradient section</a>, and hiding inside a standard layer makes it easier to miss there.</p>
<p class="interp">Where it acts: the batch's per-dimension statistics. The base form stops there and places no condition on the relations among patches within one image, which is why VICRegL, moving the same three terms to paired local features, is a separate extension.</p>`,
    },

    sigreg: {
      title: '5. Distribution Regularization',
      lead: 'A recent approach that specifies the target shape of the embedding distribution, folding several statistical conditions into a single test.',
      body: String.raw`<p class="interp">The previous methods attached conditions one at a time. Push each other apart, spread each axis this much, use the entries evenly. This one specifies the <em>goal shape</em> outright. The whole representation should form an isotropic Gaussian (a normal distribution spread equally in all directions). A distribution piled at one point differs extremely from a Gaussian, so it is excluded automatically; so is a distribution flattened along particular directions. Complete collapse and dimensional collapse get caught by one term together.</p>
<p class="definition">How do you compare high-dimensional distributions? Directly, it is hard. So SIGReg, introduced by <a href="https://arxiv.org/abs/2511.08544" target="_blank" rel="noopener">LeJEPA</a>, looks at shadows. Draw \(M\) random directions, <em>press the representations flat</em> along each to make 1-D values, and test whether each follows a normal distribution. If the shadows taken from many angles all match, the original object matches too. That is the logic.</p>
{{formula}}
<p class="interp">The shadow logic has a foundation. The <a href="https://doi.org/10.1112/jlms/s1-11.4.290" target="_blank" rel="noopener">Cramér–Wold theorem</a> (1936) says that <em>if the 1-D shadows agree in every direction, the original distributions agree</em>. But there is a gap between the theorem and the implementation. The theorem is a statement about <em>all</em> directions, while in practice only a finite \(M\) are drawn. Passing on \(M\) directions carries <em>no guarantee</em> about the whole; it is a Monte Carlo approximation steering in that direction.</p>
<p class="interp">"Why isotropy, of all things" has an old lineage. Making the projections of two views maximally correlated is Hotelling's <a href="https://doi.org/10.2307/2333955" target="_blank" rel="noopener">canonical correlation analysis</a> (1936), which carries a whitening constraint fixing each view's projected covariance to the identity. With the two projections centered and whitened, maximizing their correlation and minimizing their squared distance become interchangeable problems. In this respect joint-embedding SSL resembles CCA: the matching term corresponds to the correlation objective, and explicit variance–covariance constraints correspond to the whitening constraint. The stop-gradient family cannot be slotted into this correspondence as cleanly.</p>
<p class="interp">Seen from this angle, the camp that <em>writes statistics into the loss</em> can be lined up by how far each imitates the whitening constraint. <a href="https://arxiv.org/abs/2007.06346" target="_blank" rel="noopener">W-MSE</a> whitens embeddings explicitly, VICReg's variance and covariance terms are the same constraint softened into penalties, and SIGReg goes past second moments to nail down the whole distribution, one notch harder. The limits of this lineage-reading are equally clear. Methods using stop-gradient, EMA and predictors write no constraint into the loss and do not fit the line cleanly. <a href="https://proceedings.mlr.press/v28/andrew13.html" target="_blank" rel="noopener">Deep CCA</a> (2013), which moved the projections to neural networks, is the precedent, and <a href="https://arxiv.org/abs/2205.11508" target="_blank" rel="noopener">Balestriero and LeCun (2022)</a> organize the same lineage by reducing VICReg, SimCLR and Barlow Twins each to a corresponding spectral method.</p>
<p class="interp">One implementation caution. Do not re-divide each direction's shadow by <em>that minibatch's own standard deviation</em>. Doing so makes even a nearly collapsed Gaussian cloud of tiny variance look unit-variance, masking scale collapse. A fully constant sample has zero standard deviation and creates a separate numerical problem on top.</p>
<p class="interp">How far has it actually gone? <a href="https://arxiv.org/abs/2603.19312" target="_blank" rel="noopener">LeWorldModel</a> (Maes et al., 2026) showed a world model trained end-to-end from pixels with just two terms, this regularizer and one prediction loss, with no EMA teacher and no pretrained encoder. The paper's claim is that the tunable loss hyperparameters drop from 6 to 1 against the only prior end-to-end alternative. Note that the prediction there is next-step prediction conditioned on actions, not masked-patch recovery. Do not read it as "validated together with patch-level prediction".</p>
<p class="interp">Trade-offs. One coefficient means few <em>loss hyperparameters</em> to tune, though the stop-gradient side, which has no coefficient at all, still has real knobs in the momentum and the predictor, so what is few is the coefficients written in the loss, not the knobs overall. With no teacher copy it saves memory too. In exchange, whether an isotropic Gaussian is always the right goal is an open question. If the data actually lies on a much lower-dimensional surface, the demand "spread equally in every direction" can become pressure that crushes structure. And one coefficient does not make that one unimportant. The ratio of this term to the invariance term is exactly "how much to spread versus how much to pull together", and that ratio sets the representation's character.</p>
<p class="interp">Two implementation traps as well. Draw the directions <em>identically</em> every step from a fixed seed, and a detour opens where the encoder pretends to be Gaussian <em>on those directions only</em>. Redraw every step to keep the intent alive. And some implementations replace the test statistic with an MSE between sorted values and Gaussian quantiles. That is a <em>different estimator</em>. If you build it that way, do not keep the name; state that it is a variant.</p>
<p class="interp">Where it acts: the batch-wide embedding distribution.</p>
<p class="hint">The top panel shows the scattered representations and one of the directions (the orange line); the bottom panel shows the 1-D shadow pressed along that direction against the target normal curve. Drag toward collapse and the shadow narrows whichever way you cut, and the statistic soars. Reduce the direction count \(M\) and the statistic fluctuates. That is the price of a finite \(M\).</p>`,
    },

    pairing: {
      title: 'Prediction or Invariance?',
      lead: 'Splitting methods by where the target sits. Not a standard taxonomy, but the operational criterion this article uses to read models.',
      body: String.raw`<table class="cmp labeled">
  <thead><tr><th></th><th>Prediction: predict a hidden or future target</th><th>Invariance / view matching: align two observed views</th></tr></thead>
  <tbody>
    <tr><td>This article's criterion</td><td>target and loss sit at <em>unobserved positions</em> created by masking or the time axis</td><td>matches the representations assigned to two observed views <span class="sub">(masked views belong here too when there is no per-position target for the blanks)</span></td></tr>
    <tr><td>Kind of target</td><td>can be pixels or fixed tokens, or a learned latent representation</td><td>the other view's representation, probability distribution, cluster assignment and so on</td></tr>
    <tr><td>Spatial unit</td><td>usually patch · token · future step, but a next scene's global state is possible</td><td>pooled vectors are common, but local features occur too, as in DenseCL · VICRegL</td></tr>
    <tr><td>Representatives</td><td>MAE · BEiT · BEST-RQ <span class="sub">(fixed target)</span><br>I-JEPA · V-JEPA · data2vec <span class="sub">(learned latent target)</span></td><td>SimCLR · BYOL · DINO · VICReg · LeJEPA</td></tr>
  </tbody>
</table>
<p class="interp">The prediction this table speaks of is narrower than the everyday "predicting something". A method lands in that column only when the target sits at an unobserved position, such as a hidden patch or a future step. Within it, <em>what</em> gets predicted splits again. I-JEPA, V-JEPA and data2vec predict a learned representation \(z\); MAE, BEiT and BEST-RQ predict pixels or fixed tokens \(x\). This \(z\)-versus-\(x\) axis is the same axis as <a href="#when">the earlier section on fixed versus jointly learned targets</a>, and is independent of the prediction-versus-view-matching axis.</p>
<p class="interp">One common confusion: "it has a predictor" does not mean "prediction side". BYOL has a predictor too. In BYOL the predictor is part of <a href="#stopgrad">the collapse-blocking asymmetry</a>, unrelated to what is being matched. <strong>The predictor is not the criterion that splits the pairing.</strong></p>
<p class="interp">The canonical global view-matching recipe summarizes one image into one vector and then compares. In that case the loss carries no condition about which position should become what. In a ViT the summary can be the mean or the CLS token. Either way, what the loss directly sees is one vector.</p>
<pre class="snippet"><code># prediction side
loss = distance( pred[masked_patch], target[masked_patch] )   # patch <-> patch correspondence

# invariance side (two ways to summarize a ViT)
z1 = projector( view1.tokens.mean(patch_dim) )   # average pooling
z1 = projector( view1.cls )                      # or CLS token
loss = distance(z1, z2)                          # either way, no per-position condition</code></pre>
<p class="interp">"The loss never compares patches directly, so patches don't get trained" is wrong. CLS or mean, the gradients flow through attention down into the patch tokens. DINO indeed showed attention maps in which object outlines emerge, with no patch-level term. The precise statement is that <em>there is no per-patch target</em>. Good local features can emerge, but that objective alone does not directly specify per-position properties.</p>
<p class="interp">DINOv2 and DINOv3 do not fit the table cleanly. DINO itself belongs in the invariance column, but <a href="https://arxiv.org/abs/2304.07193" target="_blank" rel="noopener">DINOv2</a> adds a patch-level iBOT term (<a href="https://arxiv.org/abs/2111.07832" target="_blank" rel="noopener">Zhou et al., 2022</a>) on top, and <a href="https://arxiv.org/abs/2508.10104" target="_blank" rel="noopener">DINOv3</a> stacks Gram anchoring on top of that. They should be read as hybrids straddling both columns.</p>
<p class="interp">Here it becomes clear why the criterion set earlier could not be "presence of patch correspondence". <a href="https://arxiv.org/abs/2011.09157" target="_blank" rel="noopener">DenseCL</a> adds a pixel(patch)-level contrastive term to MoCo-v2: it fixes correspondences between feature-map positions and applies negatives on that correspondence. Patch correspondence sits explicitly in the loss. And yet it is on the invariance side. There is no <em>unobserved position</em> created by masking, so no loss lands on blanks. Both views are fully observed images that only went through augmentation, and corresponding positions pull close while other positions drawn as negatives push away. That is all. Patch correspondence can freely enter the invariance side too (DenseCL · VICRegL), and having a correspondence does not automatically make prediction. Conversely, iBOT's patch term fills the blanks masking created, so it has correspondence and sits on the prediction side.</p>
<p class="interp">How the views are made is another, half-independent axis. Multi-crop in particular collides head-on with tasks that demand a different answer per position; when you see the divergence of classification improving while dense degrades, <a href="#level">suspect here first</a>.</p>
<p class="definition">Augmentation and corruption are also worth separating. Augmentation expects task-relevant semantics to be the same in both views, and view matching writes that expectation into the representation. <a href="#when">The Multiview assumption</a> is not another name for augmentation but the stronger sufficiency condition that justifies the expectation. Corruption erases part of the information and has the model recover that target. Denoising autoencoders (<a href="https://doi.org/10.1145/1390156.1390294" target="_blank" rel="noopener">Vincent et al., 2008</a>) and MAE · BEiT · data2vec · I-JEPA sit in this lineage. Corruption is not free of assumptions either: it needs the assumption that predicting the erased content builds a useful representation, and that the target is recoverable to a degree from context. The two schemes simply fail under different conditions.</p>
<p class="interp">This distinction often interlocks with how views are constructed. The prediction side creates <em>unobserved positions</em>: masking in images and audio, CPC's future steps. The view-matching side leans on augmentations and multi-crop. But masking itself does not imply prediction. <a href="https://arxiv.org/abs/2204.07141" target="_blank" rel="noopener">MSN</a> matches the summary representation of a masked view to that of an unmasked view, without placing a target on each hidden patch. So by this article's criterion it is on the view-matching side. When porting a method to another domain, compare not only the objective but the original view-construction scheme along with it.</p>`,
    },

    grid: {
      title: 'A Map of Collapse Prevention',
      lead: 'The methods so far, arranged on two axes: the blocking device and the unit it applies to.',
      body: String.raw`<table class="cmp labeled">
  <thead><tr><th>Prevention method</th><th>Representative models</th><th>Loss term</th><th>Tunable coefficients</th><th>Failure prevented</th><th>Where it acts</th></tr></thead>
  <tbody>
    <tr><td>none<br><span class="sub">(a fixed target rules out 0-loss joint collapse)</span></td><td>MAE · BEiT · BEST-RQ</td><td>none</td><td>none</td><td>the 0-loss constant solution of this matching loss <span class="sub">(and nothing more)</span></td><td>n/a</td></tr>
    <tr><td>negatives</td><td>CPC · SimCLR · MoCo</td><td>\(-\log\dfrac{\exp(\mathrm{sim}(z_i,z_i^+)/\tau)}{\sum_{k\neq i}\exp(\mathrm{sim}(z_i,z_k)/\tau)}\)</td><td>1: τ <span class="sub">(softmax temperature: push only the nearest hard, or push everything evenly)</span></td><td>complete collapse <span class="sub">(dimensional collapse can still be observed, <a href="#taxonomy">Jing et al.</a>)</span></td><td>between the images in a batch <span class="sub">(base form. Variants sampling within one sample, like wav2vec 2.0, use a different unit)</span></td></tr>
    <tr><td>stop-gradient and asymmetry<br><span class="sub">(EMA usage varies by model)</span></td><td>BYOL · SimSiam · I-JEPA · V-JEPA · data2vec</td><td>no separate regularization term</td><td>stop-gradient itself: 0 <span class="sub">(with EMA, the momentum and its schedule; predictor architecture as extra knobs)</span></td><td>complete collapse <span class="sub">(the constant solution stays; the actual recipes' optimization just does not go there)</span></td><td>the unit the matching loss applies to</td></tr>
    <tr><td>centering–sharpening</td><td>DINO · DINOv2* · DINOv3*</td><td>\(-p_t\log p_s\) <span class="sub">(a cross-entropy; centering is an operation on teacher outputs)</span></td><td>2 τ + center m <span class="sub">(student and teacher temperatures, and centering's EMA coefficient)</span></td><td>complete collapse · mode collapse</td><td>batch statistics + distribution</td></tr>
    <tr><td>variance–covariance</td><td>VICReg · Barlow Twins <span class="sub">(the two do not work identically)</span></td><td>\(v(Z)=\tfrac1d\sum_j\max(0,\gamma-\sigma(z_j))\), \(\,c(Z)=\tfrac1d\sum_{i\neq j}[C(Z)]_{i,j}^2\)</td><td>3 <span class="sub">(weights of the invariance, variance and covariance terms. Barlow Twins has 1)</span></td><td>complete collapse · dimensional collapse · covariance redundancy</td><td>the batch's per-dimension statistics</td></tr>
    <tr><td>distribution matching</td><td>LeJEPA · LeWorldModel</td><td>\(\tfrac{1}{M}\sum_m T_{\text{EP}}(\{\langle z_i,u_m\rangle\}_i,\mathcal{N}(0,1))\)</td><td>1 trade-off coefficient <span class="sub">(projection count and quadrature settings are implementation values)</span></td><td>complete collapse · dimensional collapse</td><td>the batch's embedding distribution</td></tr>
  </tbody>
</table>
<p class="interp">The last column shows the range of the statistic each device computes directly. The base forms applied to global representations mostly handle between-image variance or the batch. Extensions that apply the same principle at the patch level (iBOT, VICRegL) are separated out in the next table.</p>
<p class="interp">Once more: these five are not a census. There is one more implementation of the same role (<a href="https://arxiv.org/abs/1911.05371" target="_blank" rel="noopener">SeLa</a> · <a href="https://arxiv.org/abs/2006.09882" target="_blank" rel="noopener">SwAV</a>'s equipartition, the ancestor of the role centering plays), and at least two devices that fit none of the five. <a href="https://arxiv.org/abs/2006.11477" target="_blank" rel="noopener">wav2vec 2.0</a>'s codebook diversity term keeps a <em>learned</em> codebook from using only a few codes (<a href="#when">the table in the When Does Collapse Occur? section</a> concerned codebooks that are <em>not</em> learned). The whitening of the <a href="https://arxiv.org/abs/2007.06346" target="_blank" rel="noopener">W-MSE</a> family explicitly whitens the embeddings.</p>
<p class="interp">Nor does one model live in only one row. The second column does not mean a model uses no other parts. DINO tips into a single entry without centering, and in the ablation that replaces the momentum teacher with a copy of the previous iteration's student, ViT-S/16 k-NN top-1 falls from 72.8% to 0.1%. SimSiam, in its separate recipe, trains without EMA. That result cannot be carried over as "EMA is optional inside BYOL too". Remove the same part and the outcome depends on the model's whole combination.</p>
<table class="cmp labeled">
  <thead><tr><th>Prevention method ＼ Level</th><th>patch <span class="sub">(within one image)</span></th><th>pooled <span class="sub">(between images, base form)</span></th></tr></thead>
  <tbody>
    <tr><td>negatives <span class="sub">(drawn from the batch or from within one sample)</span></td><td>CPC · wav2vec 2.0 · DenseCL <span class="sub">(wav2vec 2.0 draws from <em>the same utterance</em>, and DenseCL matches patch positions directly)</span></td><td>SimCLR · MoCo</td></tr>
    <tr><td>stop-gradient</td><td>I-JEPA · V-JEPA · data2vec</td><td>BYOL · SimSiam</td></tr>
    <tr><td>centering–sharpening</td><td>iBOT (patch term)</td><td>DINO · DINOv2* · DINOv3*</td></tr>
    <tr><td>variance–covariance</td><td>VICRegL (local term)</td><td>VICReg · Barlow Twins</td></tr>
    <tr><td>distribution matching</td><td><span class="sub">examples are still hard to find</span></td><td>LeJEPA · LeWorldModel</td></tr>
    <tr><td><span class="sub">(no separate device. The fixed target rules out only this matching loss's constant solution)</span></td><td>MAE · BEiT · BEST-RQ</td><td>none</td></tr>
  </tbody>
</table>
<p class="interp">This table's columns are a different axis from <a href="#pairing">the previous section's prediction/invariance</a>. That one points at the mechanism (does loss land on blanks?), this one at the <em>extension unit</em> (did it go down to patches, or stay pooled?). VICRegL and DenseCL are invariance by mechanism but extended to patch units, so they sit in the left column; conversely, LeWorldModel's next-step prediction is prediction by mechanism but not patch-level, so it sits in the right column (distribution matching row).</p>
<p class="interp">The two axes are largely independent. Put stop-gradient on pooled and you get BYOL; on patches, I-JEPA. Hang centering–sharpening on pooled and you get DINO; on patches, <a href="https://arxiv.org/abs/2111.07832" target="_blank" rel="noopener">iBOT</a>. Draw this table once and you can recognize the same part when you meet it in another cell. The distribution-matching cases covered in this article apply to pooled vectors, and the * on DINOv2 and DINOv3 marks hybrids straddling both cells.</p>
<p class="interp">The closest comparison is I-JEPA versus BYOL. The collapse-blocking parts are the same and only the matching scheme differs. But reading this as a clean controlled experiment where <em>only the matching scheme differs</em> is an exaggeration. The view construction (masking vs augmentation), the inputs fed to the encoders, the predictor architecture, and which layer the target comes from all differ together. The accurate reading is as an example that "part names get reused independently of the matching scheme".</p>`,
    },

    level: {
      title: 'Collapse at the Token Level',
      lead: 'Checking the variance of the global representation cannot tell you whether the spatial structure inside one image survives.',
      body: String.raw`<p class="interp">Per-image pooled vectors spreading nicely does not guarantee that each patch token preserves spatial information well. The studies that tackled this problem added training signal at different places. First gather those places in one table and then unpack them one by one. The reading key is the two right columns. <em>Type</em> points at what unit the device takes, and <em>Reference needed</em> at what it must hold separately to do so.</p>
<table class="cmp labeled">
  <thead><tr><th>Device</th><th>What it does</th><th>Type</th><th>Reference needed</th></tr></thead>
  <tbody>
    <tr><td>patch-level term (iBOT · DINOv2)</td><td>matches a masked patch's distribution to the teacher's same-position patch</td><td>positional correspondence<br><span class="sub">(statistics over the batch)</span></td><td>EMA teacher</td></tr>
    <tr><td>Dense prediction loss (V-JEPA 2.1)</td><td>scores visible patches too, but discounts the weight by distance to the mask <span class="sub">(\(\lambda/\sqrt{d_{\min}}\))</span></td><td>positional correspondence · extent</td><td>EMA teacher</td></tr>
    <tr><td>Deep self-supervision (V-JEPA 2.1)</td><td>hangs the same two losses at all four points: three intermediate blocks and the output layer</td><td>positional correspondence · depth</td><td>EMA teacher</td></tr>
    <tr><td>local contrastive term (DenseCL)</td><td>applies InfoNCE to local features paired by cosine argmax</td><td>correspondence + batch statistics</td><td>none <span class="sub">(needs cross-view matching)</span></td></tr>
    <tr><td>local VICReg term (VICRegL)</td><td>applies the same three terms to the top 20 pairs matched geometrically and semantically</td><td>correspondence + statistics</td><td>none <span class="sub">(needs cross-view matching)</span></td></tr>
    <tr><td>within-sample negatives (wav2vec 2.0)</td><td>uses other time steps of the same utterance as negatives</td><td>within-sample statistics</td><td>none</td></tr>
    <tr><td>patch-similarity penalty (Gong et al., supervised)</td><td>directly lowers the pairwise <em>absolute</em> cosine similarity of one image's patches</td><td>within-sample statistics</td><td>none</td></tr>
    <tr class="hi"><td>Gram anchoring (DINOv3)</td><td>matches the patch-similarity table to a teacher that starts from an early checkpoint and is refreshed every 10k steps</td><td>within-sample statistics</td><td>early-checkpoint-based teacher</td></tr>
  </tbody>
</table>
<p class="definition">For the masked-prediction family a fairly concrete mechanism has been reported. When the loss lands only on <em>masked</em> positions, the encoder has no reason to keep local information at the <em>visible</em> positions. Those representations are never scored; they are only intermediate computation the predictor consults. This is <a href="https://arxiv.org/abs/2603.14482" target="_blank" rel="noopener">V-JEPA 2.1</a>'s diagnosis. The spare capacity goes elsewhere, the visible tokens become depots that gather global information, and the structure of their own positions gets erased. It runs in the same direction as the <a href="https://arxiv.org/abs/2309.16588" target="_blank" rel="noopener">register token</a> observation that some patches take on global information unrelated to their position. What must not be missed here: <strong>this phenomenon does not show up as bad news in global metrics.</strong> From the pooled vector's seat, global information gathering well is if anything good news.</p>
<p class="interp"><a href="https://arxiv.org/abs/2603.14482" target="_blank" rel="noopener">Mur-Labadia et al.'s V-JEPA 2.1</a> (2026) therefore widened <a href="https://arxiv.org/abs/2506.09985" target="_blank" rel="noopener">V-JEPA 2</a>'s prediction targets from masked patches to visible ones as well. The loss becomes two terms: \(\mathcal{L}_{\text{predict}}\) on the masked positions and \(\mathcal{L}_{\text{ctx}}\) on the visible ones. Visible positions do not get the same weight, though; the weight is discounted by the minimum spatiotemporal distance to the masked region (\(\lambda_i=\lambda/\sqrt{d_{\min}(i,\mathcal{M})}\)). Patches hugging the mask boundary get scored hardest, readable as a compromise that demands local continuity while leaving distant tokens room to gather global information.</p>
<p class="interp">You have to see the numbers side by side to see this section's point. Adding the context loss took ADE20K segmentation from 22.2 to 33.8 mIoU and NYUv2 depth RMSE from 0.682 to 0.474, big gains. But <em>on the same row</em>, ImageNet-1k fell from 82.2 to 72.6 and SSv2 action recognition from 72.8 to 62.5. <strong>The term that saved dense cut global.</strong> The paper's way out of the trade is not to weaken the term but to <em>multiply the places it hangs</em>. Deep self-supervision merges representations from three intermediate encoder blocks and the output layer through a light MLP into the predictor and hangs both losses at all four points. Global performance then nearly recovers at IN1K 80.8 / SSv2 72.1 while ADE20K climbs further to 38.6. The warm-up that raises \(\lambda\) slowly over 50–100 epochs is a stabilizer laid on top.</p>
<p class="interp"><a href="https://arxiv.org/abs/2508.10104" target="_blank" rel="noopener">DINOv3</a> hit the same wall from another angle. As training runs longer, classification keeps improving while the quality of the dense features <em>drops</em>. On ViT-7B, ADE20K mIoU peaks early and loses nearly 5 points by 1M iterations, VOC segmentation turns downward from around 200k steps, and the patch cosine similarity maps grow visibly messy. Watch only global metrics and training looks like it is going well to the very end.</p>
<p class="definition">Gram anchoring matches not each patch <em>individually</em> but the <em>table of similarities between patches</em> to a teacher. \(\mathcal{L}_{\text{Gram}}=\lVert X_S X_S^\top - X_G X_G^\top\rVert_F^2\), with \(X\) the \(\ell_2\)-normalized patch feature matrix. Because it does not nail down individual features and only holds the relations, the representation keeps the freedom to translate as a whole. Worth noting that it points the opposite way from the other devices in this section. The rest push patch representations to <em>differ from each other</em>, while Gram anchoring <em>protects</em> structure that was already good.</p>
<p class="interp">So what serves as the teacher is nearly the whole of this device. DINOv3 switches this term on in the refinement stage after 1M iterations, and starts the Gram teacher from an <em>early checkpoint</em>, its own earlier self, from when the dense properties were still good. In the ablation there is little difference between checkpoints at 100k and 200k steps, but using the 1M-step one actually hurts. The anchor's value hangs not on "how well trained the teacher is" but on <strong>"the teacher from when"</strong>. During refinement it swaps in the current EMA teacher every 10k steps. The effect appears fast (about 3.3 mIoU of VOC recovers within the first 10k steps), and a high-resolution variant that runs the teacher at 2× resolution and pools it down 2×2 bicubic adds +2 mIoU on ADE20K.</p>
<p class="interp">Where the previous two hold positions within one view, <a href="https://arxiv.org/abs/2011.09157" target="_blank" rel="noopener">DenseCL</a> and <a href="https://arxiv.org/abs/2210.01571" target="_blank" rel="noopener">VICRegL</a> <em>pair</em> positions across the two views. The pairing rule is the two papers' real difference. DenseCL picks, on a 7×7 backbone feature grid, the partner with the largest cosine similarity (\(c_i=\arg\max_j\,\mathrm{sim}(f_i,f'_j)\)), giving no geometric information and letting the representations match themselves up. VICRegL uses both routes: geometric matching that traces crop coordinates back to the same spot on the source image, and semantic matching by nearest neighbors in embedding space, keeping only the top \(\gamma=20\) pairs of each to filter mismatches. On the paired positions DenseCL applies a local contrastive loss and VICRegL applies <a href="#vicreg">the three terms of the earlier section</a> as they are.</p>
<p class="interp">The three papers left knobs of the same shape. Raise DenseCL's \(\lambda\) from 0.5 to 0.9 and detection gains 0.8 AP while VOC classification falls 4.8 mAP. Lower VICRegL's \(\alpha\) from 0.9 to 0.75 and segmentation gains several points while ImageNet top-1 slips by under 1%p. V-JEPA 2.1's \(\lambda\), too, trades better segmentation for worse action recognition as it rises. <strong>A local term's weight generally shows up as an exchange rate between dense and global.</strong> Seen that way, what the recent methods do is not pick a good point on that exchange rate but find places that dodge the exchange: distance weighting (where to hang it), deep supervision (at which depth), a separate refinement stage (when) are each such attempts.</p>
<p class="interp">That does not make a local loss a necessary condition. <a href="https://arxiv.org/abs/2104.14294" target="_blank" rel="noopener">DINO</a> showed dense features in which object boundaries emerge without any explicit patch-level term. There is evidence in the opposite direction too. <a href="https://arxiv.org/abs/2104.12753" target="_blank" rel="noopener">Gong et al.</a> reported that even in <em>supervised</em> ViTs, patch representations grow alike toward deeper layers. In DeiT-Base24's last layer the mean absolute pairwise cosine similarity exceeds 0.7. If it happens without self-supervision, part of this section's phenomenon belongs to the architecture, not the objective (<a href="#open">Open Questions</a>). And this paper using the <em>absolute value</em> is not a detail to skim past: average with signs kept, and patches strung out in opposite directions cancel, giving the illusion of "nicely spread".</p>
<p class="interp">In the end, the methods differ in where they hang the loss and what they try to preserve in patch representations. Algorithms 8–10 below show by shape what changes at the point where <a href="#negatives">the earlier five devices</a> stop at \((N,d)\). \(P\) follows all the way into the loss, as \((N,P,K)\) · \((N,G,d)\) · \((N,P,P)\). Spelled out: \(N\) is the number of images in the batch, \(P\) the number of patch tokens in one image, \(d\) the embedding dimension, \(K\) the number of prototypes, and \(G\) the number of local-feature pairs matched across the two views. Read them as the bottom three rows of <a href="#level">the table above</a> put into code.</p>
<figure class="listing-row">
  <figure class="listing">
    <figcaption><b>Algorithm 8</b> iBOT</figcaption>
    <pre><code><span class="c"># one target per masked position</span>
ps = head(f(x_masked))    <span class="c"># (N, P, K)</span>
pt = head(f_t(x)).detach()
l = -(pt[mk] * ps[mk].log()).sum(-1)
loss = l.mean()   <span class="c"># mk: (N, P) mask</span>

<span class="c"># loss lands on the M masked patches only</span>
<span class="c"># -&gt; computed on (M, K)</span></code></pre>
  </figure>
  <figure class="listing">
    <figcaption><b>Algorithm 9</b> VICRegL</figcaption>
    <pre><code><span class="c"># pair patches across views, three terms</span>
i, j = match(z1, z2)   <span class="c"># top-20 pairs</span>
zl1, zl2 = z1[:, i], z2[:, j]
loss = vicreg(zl1, zl2)  <span class="c"># (N, G, d)</span>

<span class="c"># two matchers: geometry via crop</span>
<span class="c"># coords, and embedding nearest neighbors</span></code></pre>
  </figure>
  <figure class="listing">
    <figcaption><b>Algorithm 10</b> DINOv3 Gram anchoring</figcaption>
    <pre><code><span class="c"># match the relations between patches</span>
u = F.normalize(z_s, dim=-1)  <span class="c"># (N,P,d)</span>
v = F.normalize(z_g, dim=-1)  <span class="c"># Gram t.</span>
Gs, Gt = u @ u.mT, v @ v.mT   <span class="c"># (N,P,P)</span>
diff = (Gs - Gt).pow(2)
loss = diff.sum((-1, -2)).mean()

<span class="c"># z_g starts from an early checkpoint,</span>
<span class="c"># swapped for the EMA teacher every 10k steps</span></code></pre>
  </figure>
</figure>
<p class="figure-caption">All three keep the \(P\) axis into the loss. That is the token-level loss this section talks about. Gram anchoring's \((N,P,P)\) is especially worth setting beside <a href="#vicreg">VICReg's \((d,d)\) covariance</a>. One relates axis to axis, measured along the batch; in the other, \(N\) remains only as a slot and everything closes inside one image.</p>`,
    },

    open: {
      title: 'Open Questions',
      lead: 'Questions this map does not yet answer.',
      body: String.raw`<p class="interp"><strong>Under what conditions does stop-gradient reach a non-collapsed solution?</strong> This is not a claim that stop-gradient alone suffices. SimSiam, too, showed it within a recipe that includes a predictor and normalization, and BYOL · DINO · JEPA each use further, different parts. The linearized analyses and the batch-statistics counterexamples exist, but a single account carrying those results over to full nonlinear models remains open.</p>
<p class="interp"><strong>Is an isotropic Gaussian really the right goal?</strong> <a href="#sigreg">The CCA lineage</a> gives isotropy one motivation, but it is not a proof that representations must take that distribution. Follow-up work already tests other choices. <a href="https://arxiv.org/abs/2605.09241" target="_blank" rel="noopener">Sub-JEPA</a> applies the Gaussian constraint in several random subspaces, <a href="https://arxiv.org/abs/2602.01456" target="_blank" rel="noopener">Rectified LpJEPA</a> aims at sparse non-negative target distributions, and <a href="https://arxiv.org/abs/2606.01443" target="_blank" rel="noopener">UR-JEPA</a> at low-dimensional geometric structure. All three are 2026 preprints, so read them as comparisons in progress rather than established conclusions.</p>
<p class="interp"><strong>Could the cause be the architecture rather than the objective?</strong> If <a href="#taxonomy">the over-smoothing of deep ViTs</a> happens independently of the objective, part of what this article read as an SSL design problem is an architecture problem. Separating the two effects needs the control that swaps only the objective for supervised learning on the same encoder.</p>`,
    },

    closing: {
      title: 'What the Map Is For',
      lead: 'Four questions to check when reading a new SSL method.',
      body: String.raw`<p class="interp">Meeting an unfamiliar method, look at the target first. Whether it is a fixed observation or a jointly learned representation decides whether a constant solution exists. Next, find what excludes or avoids that solution: negatives, asymmetry, the balance of the output distribution, variance–covariance, distribution matching all belong here. Third is the level at which that constraint is computed. Between the images of a batch, or between the patches within one image, the preserved structure differs. Last, set the collapse metrics and a real task probe side by side. The former find trivial solutions; only the latter answers whether the needed information remains.</p>
<p class="interp">And <a href="#when">the Multiview assumption set aside earlier</a> must be reclaimed here. Collapse-prevention devices are <em>not devices that preserve information</em>. What decides what to compress between the input view and the target view is the augmentation or corruption and the task; all the prevention device does is keep that compression from ending in the trivial solution. When the assumption holds, compressing view-specific detail becomes desirable invariance; when it breaks, the representation becomes insufficient for the task without any complete collapse. So <strong>the situation where every collapse metric is normal and performance is still bad is not an anomaly. It is the normal outcome this frame predicts.</strong></p>
<p class="thesis">Self-supervised learning is the problem of deciding, between an input view and a target view, which information to preserve and which to compress. This includes not only two augmented views but also reconstruction's corrupted input → clean target. Collapse-prevention devices are not devices that preserve all information; they are constraints that keep the compression from ending in the trivial solution. When the level at which that constraint is computed differs from the level the downstream task demands, local information can vanish while the global representation looks healthy.</p>
<p class="interp"><a href="#level">The token-level cases</a> too fall into place when read through these four questions. Per-position training signal improved dense tasks across several studies, and global metrics could not predict that effect. That does not mean a global objective cannot produce good dense features. The safer, reusable conclusion is short: <strong>check the target, the device that avoids collapse, the level that device acts at, and a real task probe, each separately.</strong></p>`,
    },

    refs: {
      title: 'Glossary and References',
      lead: 'Easily confused terms first, then the cited papers gathered by theme.',
      body: String.raw`<table class="cmp labeled">
  <thead><tr><th>Term</th><th>Meaning in this post</th><th>Common misconception</th></tr></thead>
  <tbody>
    <tr><td>collapse</td><td>a state where the representation has converged near a trivial solution. This article gathers six failures with different units of observation onto one map under the name</td><td>taking it to mean complete collapse only / treating the six as an exclusive classification</td></tr>
    <tr><td>covariance redundancy</td><td>the state where axes keep repeating each other. This article's name for VICReg's "informational collapse"</td><td>reading it as the loss of information in the information-theoretic sense</td></tr>
    <tr><td>EMA</td><td>the name of a <em>part</em> that devices carry</td><td>using it like a method name parallel to BYOL · DINO</td></tr>
    <tr><td>predictor</td><td>it works in two places, sometimes at once. In BYOL · SimSiam it is the collapse-prevention part that creates the left–right asymmetry; in the I-JEPA family it is the prediction body that produces the representations of masked positions, while also being the asymmetry part</td><td>always reading it as only the anti-collapse part / mistaking it for the criterion separating prediction and invariance</td></tr>
    <tr><td>prediction vs view matching</td><td>this article's operational distinction. Target and loss at unobserved patches or future steps → prediction; matching the representations assigned to observed views → view matching</td><td>treating it as the literature's standard taxonomy / judging by predictor presence or patch correspondence alone</td></tr>
    <tr><td>token collapse</td><td>the patches within one image clumping into low dimensions. Measured with Gram rank</td><td>judging by mean cosine (fooled by sign)</td></tr>
    <tr><td>dense feature</td><td>a representation for tasks needing one vector per position</td><td>substituting classification performance for it</td></tr>
    <tr><td>KoLeo</td><td>a term that widens the distance to the nearest neighbor. Functionally it firmly rules out the constant solution, but the slot DINOv2 put it in is spreading rather than collapse prevention</td><td>reading the authors' intent and the term's function as the same thing / filing it in the same cell as the VICReg family</td></tr>
  </tbody>
</table>

<h3>Analyses of collapse itself</h3>
<ul class="refs">
  <li>Shwartz-Ziv, R., LeCun, Y. (2023). <a href="https://arxiv.org/abs/2304.09355" target="_blank" rel="noopener"><em>To Compress or Not to Compress — Self-Supervised Learning and Information Theory: A Review</em></a>. organizes SSL as a multiview information bottleneck and discusses when the assumption that preserving only shared information suffices breaks down.</li>
  <li>Hua, T., Wang, W., Xue, Z., Ren, S., Wang, Y., Zhao, H. (2021). <a href="https://arxiv.org/abs/2105.00470" target="_blank" rel="noopener"><em>On Feature Decorrelation in Self-Supervised Learning</em></a>. ICCV. split complete and dimensional collapse apart and named them.</li>
  <li>Tian, Y., Chen, X., Ganguli, S. (2021). <a href="https://arxiv.org/abs/2102.06810" target="_blank" rel="noopener"><em>Understanding Self-Supervised Learning Dynamics without Contrastive Pairs</em></a>. ICML. the linearized analysis of why BYOL · SimSiam do not collapse.</li>
  <li>Jing, L., Vincent, P., LeCun, Y., Tian, Y. (2022). <a href="https://arxiv.org/abs/2110.09348" target="_blank" rel="noopener"><em>Understanding Dimensional Collapse in Contrastive Self-supervised Learning</em></a>. ICLR.</li>
  <li>Li, A. C., Efros, A. A., Pathak, D. (2022). <a href="https://arxiv.org/abs/2209.15007" target="_blank" rel="noopener"><em>Understanding Collapse in Non-Contrastive Siamese Representation Learning</em></a>. ECCV. the relation between partial collapse and performance. What <a href="#metrics">the metrics-are-not-a-proxy section</a> leans on.</li>
  <li>Dong, Y., Cordonnier, J.-B., Loukas, A. (2021). <a href="https://arxiv.org/abs/2103.03404" target="_blank" rel="noopener"><em>Attention is Not All You Need</em></a>. ICML. rank collapse in pure attention. The paper's own conclusion, though, is that skip connections mitigate it, so a real ViT is not the theorem's subject.</li>
  <li>Gong, C., Wang, D., Li, M., Chandra, V., Liu, Q. (2021). <a href="https://arxiv.org/abs/2104.12753" target="_blank" rel="noopener"><em>Vision Transformers with Patch Diversification</em></a>. the report that patch representations grow alike even in supervised ViTs, and a penalty term against it.</li>
  <li>Zhou, D., Kang, B., Jin, X., et al. (2021). <a href="https://arxiv.org/abs/2103.11886" target="_blank" rel="noopener"><em>DeepViT: Towards Deeper Vision Transformer</em></a>.</li>
  <li>Darcet, T., Oquab, M., Mairal, J., Bojanowski, P. (2023). <a href="https://arxiv.org/abs/2309.16588" target="_blank" rel="noopener"><em>Vision Transformers Need Registers</em></a>. ICLR 2024. the phenomenon of patches being used to gather global information.</li>
</ul>

<h3>Predict pixels, or match representations?</h3>
<ul class="refs">
  <li>Vincent, P., Larochelle, H., Bengio, Y., Manzagol, P.-A. (2008). <a href="https://doi.org/10.1145/1390156.1390294" target="_blank" rel="noopener"><em>Extracting and Composing Robust Features with Denoising Autoencoders</em></a>. ICML. the original of the corruption idea, as contrasted with augmentation.</li>
  <li>LeCun, Y. (2022). <a href="https://openreview.net/forum?id=BZ5a1r-kVsf" target="_blank" rel="noopener"><em>A Path Towards Autonomous Machine Intelligence</em></a>. JEPA's original argument that the unpredictable can be discarded in representation space.</li>
  <li>He, K., Chen, X., Xie, S., Li, Y., Dollár, P., Girshick, R. (2022). <a href="https://arxiv.org/abs/2111.06377" target="_blank" rel="noopener"><em>Masked Autoencoders Are Scalable Vision Learners</em></a>. CVPR. for ViT-L, linear probe 75.8 / fine-tuning 85.9 (1600 epochs), and <em>"linear probing and fine-tuning results are largely uncorrelated"</em>.</li>
</ul>

<h3>negatives</h3>
<ul class="refs">
  <li>van den Oord, A., Li, Y., Vinyals, O. (2018). <a href="https://arxiv.org/abs/1807.03748" target="_blank" rel="noopener"><em>Representation Learning with Contrastive Predictive Coding</em></a> (CPC / InfoNCE).</li>
  <li>He, K., Fan, H., Wu, Y., Xie, S., Girshick, R. (2020). <a href="https://arxiv.org/abs/1911.05722" target="_blank" rel="noopener"><em>Momentum Contrast</em></a> (MoCo). CVPR.</li>
  <li>Chen, T., Kornblith, S., Norouzi, M., Hinton, G. (2020). <a href="https://arxiv.org/abs/2002.05709" target="_blank" rel="noopener"><em>A Simple Framework for Contrastive Learning of Visual Representations</em></a> (SimCLR). ICML.</li>
  <li>Wang, T., Isola, P. (2020). <a href="https://arxiv.org/abs/2005.10242" target="_blank" rel="noopener"><em>Understanding Contrastive Representation Learning through Alignment and Uniformity on the Hypersphere</em></a>. ICML.</li>
  <li>Baevski, A., Zhou, H., Mohamed, A., Auli, M. (2020). <a href="https://arxiv.org/abs/2006.11477" target="_blank" rel="noopener"><em>wav2vec 2.0</em></a>. NeurIPS. the already widespread "within one sample" device, drawing negatives from other time steps of the same utterance.</li>
</ul>

<h3>stop-gradient</h3>
<ul class="refs">
  <li>Grill, J.-B., Strub, F., Altché, F., Tallec, C., Richemond, P. H., et al. (2020). <a href="https://arxiv.org/abs/2006.07733" target="_blank" rel="noopener"><em>Bootstrap Your Own Latent</em></a> (BYOL). NeurIPS.</li>
  <li>Chen, X., He, K. (2021). <a href="https://arxiv.org/abs/2011.10566" target="_blank" rel="noopener"><em>Exploring Simple Siamese Representation Learning</em></a> (SimSiam). CVPR.</li>
  <li>Fetterman, A., Albrecht, J. (2020). <a href="https://imbue.com/research/2020-08-24-understanding-self-supervised-contrastive-learning/" target="_blank" rel="noopener"><em>Understanding Self-Supervised and Contrastive Learning with BYOL</em></a>. the hypothesis that the predictor's batch norm secretly plays the negatives' role.</li>
  <li>Richemond, P. H., Grill, J.-B., Altché, F., et al. (2020). <a href="https://arxiv.org/abs/2010.10241" target="_blank" rel="noopener"><em>BYOL Works Even Without Batch Statistics</em></a>. the rebuttal to that hypothesis.</li>
</ul>

<h3>Methods that shape distributions</h3>
<ul class="refs">
  <li>Asano, Y. M., Rupprecht, C., Vedaldi, A. (2020). <a href="https://arxiv.org/abs/1911.05371" target="_blank" rel="noopener"><em>Self-labelling via Simultaneous Clustering and Representation Learning</em></a> (SeLa). ICLR. the source of the equipartition constraint.</li>
  <li>Caron, M., Misra, I., Mairal, J., Goyal, P., Bojanowski, P., Joulin, A. (2020). <a href="https://arxiv.org/abs/2006.09882" target="_blank" rel="noopener"><em>SwAV</em></a>. NeurIPS. the implementation that moved it to online, soft assignments on minibatches.</li>
  <li>Caron, M., Touvron, H., Misra, I., Jégou, H., Mairal, J., Bojanowski, P., Joulin, A. (2021). <a href="https://arxiv.org/abs/2104.14294" target="_blank" rel="noopener"><em>Emerging Properties in Self-Supervised Vision Transformers</em></a> (DINO). ICCV.</li>
  <li>Assran, M., Caron, M., Misra, I., et al. (2022). <a href="https://arxiv.org/abs/2204.07141" target="_blank" rel="noopener"><em>Masked Siamese Networks</em></a> (MSN). ECCV.</li>
  <li>Zhou, J., Wei, C., Wang, H., Shen, W., Xie, C., Yuille, A., Kong, T. (2022). <a href="https://arxiv.org/abs/2111.07832" target="_blank" rel="noopener"><em>iBOT</em></a>. ICLR.</li>
  <li>Oquab, M., Darcet, T., Moutakanni, T., Vo, H. V., et al. (2024). <a href="https://arxiv.org/abs/2304.07193" target="_blank" rel="noopener"><em>DINOv2</em></a>. TMLR.</li>
  <li>Siméoni, O., Vo, H. V., Seitzer, M., et al. (2025). <a href="https://arxiv.org/abs/2508.10104" target="_blank" rel="noopener"><em>DINOv3</em></a>. prescribes Gram anchoring for the degradation of patch representations in long training.</li>
</ul>

<h3>Methods that write statistics into the loss</h3>
<ul class="refs">
  <li>Zbontar, J., Jing, L., Misra, I., LeCun, Y., Deny, S. (2021). <a href="https://arxiv.org/abs/2103.03230" target="_blank" rel="noopener"><em>Barlow Twins</em></a>. ICML.</li>
  <li>Bardes, A., Ponce, J., LeCun, Y. (2022). <a href="https://arxiv.org/abs/2105.04906" target="_blank" rel="noopener"><em>VICReg</em></a>. ICLR.</li>
  <li>Bardes, A., Ponce, J., LeCun, Y. (2022). <a href="https://arxiv.org/abs/2210.01571" target="_blank" rel="noopener"><em>VICRegL</em></a>. NeurIPS. the precedent applying the same criteria to paired local features.</li>
  <li>Ermolov, A., Siarohin, A., Sangineto, E., Sebe, N. (2021). <a href="https://arxiv.org/abs/2007.06346" target="_blank" rel="noopener"><em>Whitening for Self-Supervised Representation Learning</em></a> (W-MSE). ICML.</li>
  <li>Wang, X., Zhang, R., Shen, C., Kong, T., Li, L. (2021). <a href="https://arxiv.org/abs/2011.09157" target="_blank" rel="noopener"><em>Dense Contrastive Learning</em></a> (DenseCL). CVPR. the control where adding only the pixel-level term, on the same backbone and schedule, improved dense performance.</li>
  <li>Balestriero, R., LeCun, Y. (2025). <a href="https://arxiv.org/abs/2511.08544" target="_blank" rel="noopener"><em>LeJEPA</em></a>. the paper that introduced SIGReg.</li>
  <li>Maes, L., Le Lidec, Q., Scieur, D., LeCun, Y., Balestriero, R. (2026). <a href="https://arxiv.org/abs/2603.19312" target="_blank" rel="noopener"><em>LeWorldModel</em></a>. the construction trained with just two terms, a prediction loss and SIGReg.</li>
  <li>Cramér, H., Wold, H. (1936). <a href="https://doi.org/10.1112/jlms/s1-11.4.290" target="_blank" rel="noopener"><em>Some Theorems on Distribution Functions</em></a>. J. London Math. Soc. 11(4).</li>
  <li>Epps, T. W., Pulley, L. B. (1983). <a href="https://doi.org/10.1093/biomet/70.3.723" target="_blank" rel="noopener"><em>A Test for Normality Based on the Empirical Characteristic Function</em></a>. Biometrika 70(3). the original paper of the test statistic SIGReg uses on each 1-D projection.</li>
  <li>Hotelling, H. (1936). <a href="https://doi.org/10.2307/2333955" target="_blank" rel="noopener"><em>Relations Between Two Sets of Variates</em></a>. Biometrika 28(3/4). the original CCA paper, whitening constraint included.</li>
  <li>Andrew, G., Arora, R., Bilmes, J., Livescu, K. (2013). <a href="https://proceedings.mlr.press/v28/andrew13.html" target="_blank" rel="noopener"><em>Deep Canonical Correlation Analysis</em></a>. ICML. the precedent replacing CCA's projections with neural networks.</li>
  <li>Balestriero, R., LeCun, Y. (2022). <a href="https://arxiv.org/abs/2205.11508" target="_blank" rel="noopener"><em>Contrastive and Non-Contrastive Self-Supervised Learning Recover Global and Local Spectral Embedding Methods</em></a>. NeurIPS. reduces VICReg, SimCLR and Barlow Twins to corresponding spectral methods.</li>
  <li>Czinner, S. (2025). <a href="https://shonczinner.github.io/posts/embedding-prediction/" target="_blank" rel="noopener"><em>The 90-year-old idea behind JEPA models: Canonical Correlation Analysis</em></a>. the post connecting this lineage directly to JEPA and SIGReg. A personal blog's synthesis, not a peer-reviewed result.</li>
  <li>Zhao, K., et al. (2026). <a href="https://arxiv.org/abs/2605.09241" target="_blank" rel="noopener"><em>Sub-JEPA</em></a>. · Kuang, Y., et al. (2026). <a href="https://arxiv.org/abs/2602.01456" target="_blank" rel="noopener"><em>Rectified LpJEPA</em></a>. · Le, T. M., et al. (2026). <a href="https://arxiv.org/abs/2606.01443" target="_blank" rel="noopener"><em>UR-JEPA</em></a>. follow-up preprints each pushing on "is the isotropic Gaussian the right goal" from a different direction.</li>
</ul>

<h3>Methods with fixed targets</h3>
<ul class="refs">
  <li>Bao, H., Dong, L., Piao, S., Wei, F. (2022). <a href="https://arxiv.org/abs/2106.08254" target="_blank" rel="noopener"><em>BEiT</em></a>. ICLR.</li>
  <li>Chiu, C.-C., Qin, J., Zhang, Y., Yu, J., Wu, Y. (2022). <a href="https://arxiv.org/abs/2202.01855" target="_blank" rel="noopener"><em>BEST-RQ</em></a>. ICML.</li>
</ul>

<h3>Methods that predict in representation space</h3>
<ul class="refs">
  <li>Baevski, A., Hsu, W.-N., Xu, Q., Babu, A., Gu, J., Auli, M. (2022). <a href="https://arxiv.org/abs/2202.03555" target="_blank" rel="noopener"><em>data2vec</em></a>. ICML.</li>
  <li>Assran, M., Duval, Q., Misra, I., et al. (2023). <a href="https://arxiv.org/abs/2301.08243" target="_blank" rel="noopener"><em>I-JEPA</em></a>. CVPR.</li>
  <li>Bardes, A., Garrido, Q., Ponce, J., et al. (2024). <a href="https://arxiv.org/abs/2404.08471" target="_blank" rel="noopener"><em>V-JEPA</em></a>.</li>
  <li>Assran, M., Bardes, A., Fan, D., et al. (2025). <a href="https://arxiv.org/abs/2506.09985" target="_blank" rel="noopener"><em>V-JEPA 2</em></a>.</li>
  <li>Mur-Labadia, L., Muckley, M., Bar, A., et al. (2026). <a href="https://arxiv.org/abs/2603.14482" target="_blank" rel="noopener"><em>V-JEPA 2.1: Unlocking Dense Features in Video Self-Supervised Learning</em></a>.</li>
</ul>`,
    },
  },

  // Korean strings living outside .topic-text — demo chrome, figure captions,
  // listing figcaptions, and the Korean \text{} runs inside carried-over math.
  ui: [
    ['맞혀야 할 target', 'target to match'],
    ['선으로 이은 한 쌍 = 같은 샘플·위치', 'one linked pair = same sample and position'],
    ['고정 target과 함께 학습되는 target의 예시', 'Examples of fixed and learned targets'],
    ['고정 target 예시', 'Fixed-target examples'],
    ['원본 관측값: MAE의 픽셀<br>고정된 cluster index: BEiT·BEST-RQ의 code index<br>고정된 latent: frozen encoder의 출력', 'Raw observations: MAE’s pixels<br>Fixed cluster index: the code indices of BEiT · BEST-RQ<br>Fixed latent: a frozen encoder’s output'],
    ['학습되는 target 예시', 'Learned-target examples'],
    ['학습되는 cluster index: SwAV의 assignment, DINO의 prototype 분포<br>학습되는 latent: BYOL·SimSiam의 다른 view latent, I-JEPA의 target-block latent', 'Learned cluster index: SwAV’s assignments, DINO’s prototype distribution<br>Learned latent: the other-view latent of BYOL · SimSiam, I-JEPA’s target-block latent'],
    ['점의 2차원 위치는 output/target 공간을 도식화한 것이다. 입력 데이터의 좌표도, cluster 중심도 아니다. 왼쪽 target은 관측값·code·latent 중 무엇이든 될 수 있지만 학습 중에는 고정되고, 오른쪽 target은 다른 view를 처리하는 encoder가 바뀌면서 함께 움직인다.', 'The 2-D positions of the dots schematize the output/target space. They are neither input-data coordinates nor cluster centroids. The left target can be an observation, a code or a latent, but stays fixed during training; the right target moves as the encoder processing the other view changes.'],
    ['처음부터 다시', 'Restart'],
    ['재생', 'Play'],
    ['둘 다', 'Both'],
    ['centering 끔', 'centering off'],
    ['sharpening 끔', 'sharpening off'],
    ['collapse 정도 =', 'collapse amount ='],
    ['방향 수 M =', 'directions M ='],
    ['방향 다시 뽑기', 'Resample directions'],
    ['큐에서 뽑는 negative (MoCo)', 'negatives drawn from a queue (MoCo)'],
    ['느린 복사본을 target으로 (BYOL)', 'a slow copy as the target (BYOL)'],
    ['EMA 없이 같은 인코더로 (SimSiam)', 'one shared encoder, no EMA (SimSiam)'],
    ['centering과 sharpening (DINO)', 'centering and sharpening (DINO)'],
    ['분산과 공분산을 loss에 적기 (VICReg)', 'writing variance and covariance into the loss (VICReg)'],
    ['분포 자체를 목표로 두기 (SIGReg, LeJEPA)', 'the distribution itself as the goal (SIGReg, LeJEPA)'],
    // Korean runs inside the source formulas carried over by {{formula}}.
    ['\\text{고정 target: }', '\\text{fixed target: }'],
    ['\\text{함께 학습되는 target: }', '\\text{jointly learned target: }'],
    ['\\text{는 움직이지 않는다}', '\\text{ does not move}'],
    ['\\text{ 에서 } 0', '\\text{ gives } 0'],
  ],

  // Korean comments inside the <pre> listings of Algorithms 1–7 (the demo rail).
  // Algorithms 8–10 live inside .topic-text and ship English via the body above.
  codeComments: [
    ['z    = f(x).mean(1) -&gt; (N, d)  P를 여기서 접는다', 'z    = f(x).mean(1) -&gt; (N, d)  P folded here'],
    ['아래에 P축이 없다 -&gt; pooled embedding loss', 'no P axis below -&gt; pooled embedding loss'],
    ['자기 자신 제외', 'drop self-pairs'],
    ['(2N, 2N)은 이미지끼리의 관계다. patch가 아니다.', '(2N, 2N) relates images to images. Not patches.'],
    ['전부 뭉치면 log(2N-1)에 붙는다. 바닥이 아니다.', 'full collapse pins it at log(2N-1). Not the floor.'],
    ['q : (N, d) student.  k : (N, d) EMA 인코더', 'q : (N, d) student.  k : (N, d) EMA encoder'],
    ['queue : (d, K) 과거 배치에서 쌓인 negative', 'queue : (d, K) negatives piled from past batches'],
    ['여기도 축은 N뿐이다 -&gt; pooled embedding loss', 'again the only axis is N -&gt; pooled embedding loss'],
    ['정답은 0번', 'the label is 0'],
    ['K를 키우면 negative 수가 batch에서 떨어져 나온다.', 'growing K decouples negatives from batch size.'],
    ['EMA(m ~ 0.999)는 붕괴 방지 장치가 아니다. 막는', 'EMA (m ~ 0.999) is not the anti-collapse device.'],
    ['일은 l_neg가 하고, EMA는 큐의 앞뒤를 맞춘다.', 'l_neg does that; EMA keeps the queue coherent.'],
    ['f : online,  f_t : EMA 복사본,  h : predictor', 'f : online,  f_t : EMA copy,  h : predictor'],
    ['둘 다 (N, P, d)를 pool한 (N, d)를 내놓는다', 'both emit (N, d), pooled down from (N, P, d)'],
    ['D가 (N, d)끼리의 거리다 -&gt; pooled embedding loss', 'D is a distance between (N, d) -&gt; pooled loss'],
    ['(N, d) predictor 통과', '(N, d) through predictor'],
    ['m: 0.996 -&gt; 1.0 스케줄. 이 장치에서 &quot;세게 건다&quot;는', 'm: 0.996 -&gt; 1.0 schedule. Here &quot;stronger&quot; means'],
    ['계수가 아니라 momentum이다. 축이 아예 다르다.', 'momentum, not a coefficient. A different axis.'],
    ['f 하나를 양쪽에 쓴다. 복사본이 없다.', 'one f on both sides. No copy.'],
    ['^^^^^^^^^ 이 detach가 대칭을 깬다', '^^^^^^^^^ this detach breaks the symmetry'],
    ['detach를 빼면 무너지고, 남겨 두면 안 무너진다.', 'remove the detach and it collapses; keep it, it holds.'],
    ['다만 이 코드에 상수 해를 배제하는 항은 없다.', 'yet nothing here rules out the constant solution.'],
    ['모든 입력을 같은 벡터로 보내도 loss는 0이다.', 'map every input to one vector: the loss is still 0.'],
    ['막는 것은 loss가 아니라 gradient의 경로다.', 'what blocks it is the gradient path, not the loss.'],
    ['level은 이 장치가 정하지 않는다. 위 z를 pool하지', 'the level is not set by this device. Keep z above'],
    ['않고 (N, P, d)로 두면 그대로 token level이 된다.', 'as (N, P, d) instead of pooling: token level.'],
    ['I-JEPA가 정확히 그 자리에 있다.', 'I-JEPA sits exactly there.'],
    ['f(x) : (N, P, d) -&gt; CLS 또는 mean -&gt; (N, d)', 'f(x) : (N, P, d) -&gt; CLS or mean -&gt; (N, d)'],
    ['g(z) : (N, K)  K개 prototype 위의 분포', 'g(z) : (N, K)  distribution over K prototypes'],
    ['iBOT는 같은 항을 (N, P, K)에 건다 -&gt; Algorithm 8', 'iBOT puts the same term on (N, P, K) -&gt; Algorithm 8'],
    ['(K,) 배치평균', '(K,) batch mean'],
    ['tau_t는 첫 30 epoch 동안 0.04 -&gt; 0.07로 올린다.', 'tau_t rises 0.04 -&gt; 0.07 over the first 30 epochs.'],
    ['위험한 쪽이 높은 temperature이기 때문이다.', 'because the dangerous side is high temperature.'],
    ['0.06을 넘기면 loss가 log K로 수렴한다. 모든', 'above 0.06 the loss converges to log K: the state'],
    ['항목에 똑같은 확률을 주는 상태다.', 'giving every entry the same probability.'],
    ['한 줄씩 지우면 실패 방향이 갈린다:', 'delete one line at a time; the failures diverge:'],
    ['C를 빼는 항 제거 -&gt; 항목 perplexity가 1로', 'remove the -C -&gt; usage perplexity falls to 1'],
    ['tau_t = 1.0      -&gt; 사진별 엔트로피가 최댓값에', 'tau_t = 1.0      -&gt; per-photo entropy hits its max'],
    ['통계를 내는 축이 N(배치)이다 -&gt; pooled loss', 'statistics run along N (the batch) -&gt; pooled loss'],
    ['VICRegL은 같은 세 항을 (N, G, d)에 건다', 'VICRegL puts the same three terms on (N, G, d)'],
    ['^ GPU마다 재면 세기가 GPU 수에 딸린다.', '^ per-GPU stats tie the strength to the GPU count.'],
    ['(d, d)는 축과 축의 관계를 N을 따라 잰 것이다.', '(d, d) relates axis to axis, measured along N.'],
    ['Algorithm 10의 (N,P,P)와 나란히 볼 것.', 'set it beside Algorithm 10’s (N,P,P).'],
    ['z : (N, d)  pooled embedding. 통계 축은 N이다.', 'z : (N, d)  pooled embedding. The stat axis is N.'],
    ['^ 매 step 새로 뽑을 것. seed를 고정하면 인코더가', '^ redraw every step. Fix the seed and the encoder'],
    ['&quot;그 M개 방향 위에서만&quot; 정규분포인 척할 수 있다.', 'can fake normality &quot;on those M directions only&quot;.'],
    ['(N, M) 1차원 그림자', '(N, M) 1-D shadows'],
    ['proj = proj / proj.std(0)  &lt;- 하면 안 된다.', 'proj = proj / proj.std(0)  &lt;- do NOT do this.'],
    ['거의 붕괴한 좁은 구름도 단위 분산처럼 보인다.', 'a near-collapsed narrow cloud looks unit-variance.'],
    ['계수는 lam 하나', 'one coefficient: lam'],
    ['검정 대상은 (N, M)의 각 열, 즉 배치를 따라 모은', 'the test sees each column of (N, M): a sample'],
    ['표본이다. 한 이미지 안의 구조는 보지 않는다.', 'gathered along the batch. Within-image structure is unseen.'],
  ],
};
