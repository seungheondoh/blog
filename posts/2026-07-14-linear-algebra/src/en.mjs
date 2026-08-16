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
  title: 'Interactive Linear Algebra — Blog',
  description:
    'An interactive introduction to vectors, inner products, linear transformations, eigenvectors, subspaces, basis changes, and PyTorch tensor operations.',

  // Fills the <h1> and the first index-nav entry.
  heading: 'Interactive Linear Algebra',
  languageLink: '<a class="language-link" href="./ko.html" lang="ko">Korean ver.</a>',

  // Replaces everything between the intro:start / intro:end markers.
  intro: String.raw`
  <p class="la-sub">A language model sees tokens as vectors. A vision model arranges pixels and features into tensors. A retrieval system compares a query with millions of documents by taking inner products. Different applications, same mathematical machinery.</p>
  <p class="la-sub">That machinery is <strong>linear algebra</strong>: the study of vector spaces, the transformations between them, and the matrices that represent those transformations. It is the language behind embeddings, attention, PCA, SVD, and the matrix multiplications inside every neural-network layer.</p>
  <p class="la-sub">But why is it called <em>linear</em>? Because a function \(f\) earns that name only by satisfying <em>both</em> of these conditions.</p>
  <ul class="la-axioms">
    <li><strong>Additivity</strong> <span class="la-axiom-eq">\(f(x+y)=f(x)+f(y)\)</span> <span class="la-axiom-note">transforming two inputs separately and adding gives the same answer as adding first and transforming once.</span></li>
    <li><strong>Homogeneity</strong> <span class="la-axiom-eq">\(f(cx)=c\,f(x)\)</span> <span class="la-axiom-note">scaling the input by \(c\) scales the output by exactly \(c\).</span></li>
  </ul>
  <p class="la-sub">Together they promise that a problem can be broken apart, solved piece by piece, and reassembled. That is why any vector can be decomposed into a combination of basis vectors, and why a transformation is completely described by what it does to those basis vectors alone—which is precisely what a <strong>matrix</strong> records.</p>
  <p class="la-sub">Differentiation and integration both qualify: \((af+bg)'=af'+bg'\) and \(\int(af+bg)=a\int f+b\int g\). So on a function space with a chosen basis—polynomials, say—even differentiation becomes <em>a single matrix</em> you can multiply by. The line \(y=mx+n\) with \(n\neq 0\), by contrast, is not linear despite being straight: \(f(x+y)=m(x+y)+n\) while \(f(x)+f(y)=m(x+y)+2n\), and \(f(cx)=cmx+n\) while \(c\,f(x)=cmx+cn\). Setting \(c=0\) in the second condition forces \(f(0)=0\), so <strong>anything that misses the origin cannot be linear.</strong> Such a map is called <strong>affine</strong>, and the bias term in a neural-network layer is exactly that offset.</p>
  <p class="la-sub">This post develops the ideas in that order: first the geometric intuition, then the algebraic definition, and finally the connection to machine learning. Throughout, the aim is to see how a change in the equations corresponds to a change in the geometry.</p>`,

  footnote: 'References: the linear algebra series at <a href="https://angeloyeo.github.io/" target="_blank" rel="noopener noreferrer">angeloyeo.github.io</a> and Goodfellow, Bengio &amp; Courville, <a href="https://www.deeplearningbook.org/contents/linear_algebra.html" target="_blank" rel="noopener noreferrer"><em>Deep Learning</em>, Chapter 2</a>.',

  navLabel: 'Topics in this article',

  topics: {
  vector: {
    title: 'What Is a Vector?',
    lead: 'Let us start with the object that everything else in linear algebra is built from: the vector. The same idea can describe a physical displacement, an image, a sound clip, or an embedding inside a machine-learning model.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> A vector is an element of a vector space. We begin with vectors in \(\mathbb{R}^n\), written as ordered lists of real numbers: \(v=(v_1,\ldots,v_n)\). In two and three dimensions, a vector can be visualized as an arrow with magnitude and direction.</p><p class="interp"><strong>Geometrically.</strong> Think of an arrow drawn from the origin to a point. Its length is the magnitude and the way it points is the direction. For example, \(v=(3,1)\) points three units to the right and one unit upward.</p><p class="interp"><strong>Algebraically.</strong> Its Euclidean length, \(\|v\|=\sqrt{v_1^2+\cdots+v_n^2}\), is the Pythagorean theorem extended to \(n\) coordinates. The same definition works in four or four thousand dimensions, even when there is no picture we can draw.</p>{{formula}}<p class="interp"><strong>Another description: polar coordinates.</strong> In two dimensions we can replace \((x,y)\) with a magnitude \(r=\|v\|\) and an angle \(\theta\): \(v=(r\cos\theta,r\sin\theta)\). Cartesian and polar coordinates describe the same arrow. This is our first example of an important theme: the representation may change while the object does not.</p><p class="interp"><strong>Why the trigonometric functions appear.</strong> The value \(\cos\theta\) measures alignment through \(\cos\theta=(a\cdot b)/(\|a\|\|b\|)\), while \(\sin\theta\) controls the area spanned by two vectors through \(\|a\times b\|=\|a\|\|b\|\sin\theta\). Finally, \(\tan\theta=y/x\) is the slope of the direction, and \(\operatorname{atan2}(y,x)\) recovers the angle from the coordinates.</p>{{formula}}<p class="hint">Drag the vector and watch its Cartesian coordinates, magnitude, and angle change together. The unit-circle panel shows the corresponding sine, cosine, and tangent.</p>`,
  },
  operations: {
    title: 'Vector Operations',
    lead: 'Once we have vectors, what can we do with them? Three simple operations—addition, subtraction, and scaling—are enough to build nearly every construction that follows.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> Vector addition and subtraction operate componentwise. Scalar multiplication multiplies every component by the same number: \(v+w\), \(v-w=v+(-w)\), and \(kv\). The average \((v+w)/2\) is simply a sum scaled by one half.</p><p class="interp"><strong>In the picture.</strong> Scaling changes the arrow’s length by a factor of \(|k|\); a negative \(k\) also reverses its direction. To add two vectors, place the tail of the second at the tip of the first. The arrow from the origin to the final tip is \(v+w\), also the diagonal of their parallelogram.</p><p class="interp">Subtraction has an equally useful interpretation: \(v-w\) points from the tip of \(w\) to the tip of \(v\), so \(\|v-w\|\) measures the distance between the two endpoints. Meanwhile, \((v+w)/2\) lands at their midpoint.</p><p class="interp"><strong>Algebraically.</strong> \(v+w=(v_1+w_1,\ldots,v_n+w_n)\), \(v-w=(v_1-w_1,\ldots,v_n-w_n)\), and \(kv=(kv_1,\ldots,kv_n)\). Expressions such as \(c_1v+c_2w\) lead to linear combinations. Averaging many vectors gives their centroid, a simple way to construct a representative embedding.</p><p class="hint">Drag \(v\) and \(w\), then adjust \(k\) to compare the sum, difference, scaled vector, and midpoint.</p>`,
  },
  norm: {
    title: 'Norms',
    lead: 'How long is a vector? A norm answers that question with a single nonnegative number. The catch is that there is more than one sensible way to measure length, and each choice gives the space a different geometry.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> A norm \(\|v\|\) measures the size of a vector with a nonnegative scalar. The familiar Euclidean, or L2, norm is only one choice. Common examples are \(\|v\|_1=\sum_i|v_i|\), \(\|v\|_2=\sqrt{\sum_i v_i^2}\), and \(\|v\|_\infty=\max_i|v_i|\).</p><p class="interp"><strong>Geometrically.</strong> Compare all points whose norm is one. In two dimensions these unit spheres are a circle for L2, a diamond for L1, and a square for L∞. Their interiors, \(\{v:\|v\|\leq1\}\), are the corresponding unit balls.</p><p class="interp"><strong>What makes a norm a norm?</strong> It must satisfy positivity, \(\|v\|\geq0\) with equality only at zero; absolute homogeneity, \(\|kv\|=|k|\|v\|\); and the triangle inequality, \(\|v+w\|\leq\|v\|+\|w\|\). The L2 norm connects directly to the next section because \(\|v\|_2=\sqrt{v\cdot v}\).</p><p class="interp"><strong>Embedding normalization.</strong> Dividing a nonzero embedding by its norm gives a unit vector in the same direction: \(\hat v=v/\|v\|\). The inner product of two L2-normalized embeddings is their cosine similarity, \(\hat v\cdot\hat w=(v\cdot w)/(\|v\|\|w\|)=\cos\theta\). Contrastive models such as CLIP and SimCLR use this idea so that direction, rather than arbitrary magnitude, drives the comparison.</p><p class="interp"><strong>What changes in high dimensions?</strong> The definitions do not: magnitude is still \(\sqrt{\sum_i v_i^2}\), and the inner product still accumulates how corresponding components align. Features in a neural representation are usually distributed across many coordinates rather than assigned one meaning per dimension. Random vectors from a high-dimensional isotropic distribution have cosine values concentrated near zero, but learned embeddings may be anisotropic, so a cosine score should be interpreted relative to the model and its data.</p><p class="interp"><strong>Why probabilities use L1 normalization.</strong> A probability vector has nonnegative entries and must satisfy \(\sum_i p_i=1\). Because its entries are nonnegative, this is exactly \(\|p\|_1=1\). Dividing a positive vector by its L1 norm creates a probability distribution. Softmax follows the same recipe: exponentiate to make every entry positive, then divide by their sum.</p><p class="hint">Drag the vector to compare the three norms, or play the L2 embedding and L1 probability normalization animations.</p>`,
  },
  dot: {
    title: 'Dot and Inner Products',
    lead: 'A norm tells us about one vector. To compare two vectors, we turn to the inner product: a single number that captures how strongly they point in the same direction.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> For real coordinate vectors, \(r\cdot v=\sum_i r_i v_i\).</p><p class="interp"><strong>Geometrically.</strong> \(r\cdot v=\|r\|\|v\|\cos\theta\). The value is positive for acute angles, zero for orthogonal vectors, and negative for obtuse angles.</p><p class="interp"><strong>Algebraically.</strong> For fixed \(r\), the map \(v\mapsto r\cdot v\) is a linear functional. The signed projection length of \(v\) onto the direction of \(r\) is \((r\cdot v)/\|r\|\).</p><p class="interp"><strong>Why are those the same number?</strong> "Multiply the coordinates and add them up" and "\(\|r\|\|v\|\cos\theta\)" look unrelated. The bridge between them is that <em>a coordinate product is a per-direction measurement</em>. Split \(v\) into \(v_1\hat\imath+v_2\hat\jmath\); linearity then gives \(r\cdot v=v_1(r\cdot\hat\imath)+v_2(r\cdot\hat\jmath)=v_1r_1+v_2r_2\), so the coordinate formula is nothing but "measure along each axis separately, then add." Meanwhile \(r\cdot\hat u\) is exactly the length of the shadow \(r\) casts along a unit direction \(\hat u\). The two expressions therefore measure one quantity in two different bases, and the length of a shadow does not care how we rotated the axes.</p><p class="interp"><strong>Intuition: an alignment score.</strong> Read the dot product as "how much do these two vectors look the same way," weighted by both lengths, and the signs become obvious: positive when they agree, zero when they are perpendicular, negative when they oppose. The coordinate formula tells the same story — \(r_iv_i\) contributes a positive amount only when the two vectors agree in sign along axis \(i\), so the sum is a vote tallied across the axes over how much they agree. Embedding search scores similarity by running that vote across hundreds of dimensions at once.</p><p class="hint">Drag both vectors and observe the projection and cosine value.</p>`,
  },
  cross: {
    title: 'Cross Product',
    lead: 'The dot product measures alignment. In three dimensions, the cross product gives us something complementary: a direction perpendicular to both inputs and a magnitude equal to the area between them.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> For \(a,b\in\mathbb{R}^3\), the cross product \(a\times b\) is perpendicular to both vectors.</p><p class="interp"><strong>Geometrically.</strong> Its magnitude is \(\|a\times b\|=\|a\|\|b\|\sin\theta\), the area of the parallelogram spanned by \(a\) and \(b\). Reversing the operands reverses the direction.</p><p class="interp"><strong>Algebraically.</strong> \(a\times b=(a_2b_3-a_3b_2,\ a_3b_1-a_1b_3,\ a_1b_2-a_2b_1)\). For vectors in the xy-plane, its z-component is the corresponding 2×2 determinant.</p><p class="hint">Drag the two planar vectors and inspect the perpendicular green vector in the 3D view.</p>`,
  },
  combination: {
    title: 'Linear Combinations',
    lead: 'Suppose we may scale a few vectors and add the results. Which points can we reach? Linear combinations turn that simple question into one of the central ideas of linear algebra.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> An expression \(c_1v_1+\cdots+c_kv_k\), with scalar coefficients \(c_i\), is a linear combination.</p><p class="interp"><strong>Geometrically.</strong> Each coefficient controls how far and in which orientation to move along its corresponding vector.</p><p class="interp"><strong>Algebraically.</strong> Matrix–vector multiplication is a linear combination of the columns of \(A\): \(Ax=x_1a_1+\cdots+x_na_n\). Thus \(Ax=b\) asks whether \(b\) lies in the span of those columns.</p>{{formula}}<p class="hint">(\(a_i\) is the \(i\)-th column of \(A\).)</p><p class="hint">Adjust the coefficients to construct different points from the two columns.</p>`,
  },
  independence: {
    title: 'Independence, Span, and Basis',
    lead: 'Having more vectors does not always mean having more information. Independence detects redundant directions; a basis keeps exactly enough directions to describe the whole space.',
    body: String.raw`<p class="definition"><strong>Linear independence.</strong> Vectors \(v_1,\ldots,v_n\) are independent if \(c_1v_1+\cdots+c_nv_n=0\) forces every coefficient to be zero. If a nontrivial choice also gives zero, the vectors are dependent: at least one direction was already obtainable from the others.</p><p class="definition"><strong>Span.</strong> The span is the set of every linear combination: \(\operatorname{span}\{v_1,\ldots,v_n\}=\{c_1v_1+\cdots+c_nv_n:c_i\in\mathbb R\}\).</p><p class="definition"><strong>Basis and dimension.</strong> A basis is both independent and spanning. Every basis of a finite-dimensional space contains the same number of vectors, and that number is the dimension.</p><p class="interp"><strong>In the picture.</strong> One nonzero vector spans a line through the origin. Two nonparallel vectors span the whole plane and form a basis of \(\mathbb R^2\). As they become parallel, the span collapses back to a line: the second vector adds no genuinely new direction.</p><p class="interp"><strong>The determinant test.</strong> In \(n\) dimensions, place \(n\) vectors in the columns of a square matrix. Then \(\det A\neq0\), linear independence, spanning the whole space, and forming a basis are equivalent statements. If \(\det A=0\), the span has dimension below \(n\).</p><p class="hint">Drag the vectors until they become parallel and observe the determinant, span, and rank change together.</p>`,
  },
  function: {
    title: 'Linear Functions',
    lead: 'What makes a function linear? It must respect the two operations we just introduced: adding inputs and scaling them. That modest requirement makes the entire function predictable from what it does to a basis.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> A function \(f\) is linear when \(f(x+y)=f(x)+f(y)\) and \(f(cx)=cf(x)\).</p><p class="interp"><strong>Geometrically.</strong> A linear function maps the origin to zero and preserves the linear structure of the domain. For \(f(x)=r\cdot x\), equal-valued inputs form parallel hyperplanes perpendicular to \(r\).</p><p class="interp"><strong>Algebraically.</strong> The map \(f(v)=r\cdot v\) is a standard example. Adding a nonzero constant, as in \(g(x)=r\cdot x+b\), produces an affine rather than a linear function.</p><p class="hint">Drag \(A\) and \(B\) to verify \(f(A+B)=f(A)+f(B)\).</p>`,
  },
  transform: {
    title: 'Linear Transformations',
    lead: 'Now let the output be a vector rather than a scalar. A linear transformation can rotate, scale, reflect, or shear a space, but it must preserve the space’s linear structure.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> A map between vector spaces is linear if it preserves addition and scalar multiplication. After bases are chosen, every finite-dimensional linear map is represented by a matrix \(A\).</p><p class="interp"><strong>Geometrically.</strong> The images of the standard basis vectors are the columns of \(A\). Once those images are known, linearity determines the image of every vector.</p><p class="interp"><strong>Algebraically.</strong> \(A(x,y)^\top=xA\hat\imath+yA\hat\jmath\), a linear combination of the transformed basis vectors.</p><p class="hint">Modify the four matrix entries or select a preset to transform the grid.</p>`,
  },
  multiply: {
    title: 'Matrix Multiplication',
    lead: 'Matrix multiplication can look like an arbitrary bookkeeping rule. Its real purpose becomes clearer when we read matrices as transformations: multiplying matrices means composing those transformations.',
    body: String.raw`<p class="definition"><strong>First, what is a matrix?</strong> An \(m\times n\) matrix is a rectangular table with \(m\) rows and \(n\) columns; \(A_{ij}\) denotes the entry in row \(i\), column \(j\). A column vector is simply an \(n\times1\) matrix.</p><p class="definition"><strong>Definition.</strong> If \(A\in\mathbb{R}^{m\times n}\) and \(B\in\mathbb{R}^{n\times p}\), then \(AB\) is the \(m\times p\) matrix with \((AB)_{ik}=\sum_j A_{ij}B_{jk}\). The inner dimensions must match.</p><p class="interp"><strong>As composition.</strong> The order in \((AB)x=A(Bx)\) runs from right to left: apply \(B\) first, then \(A\). Deforming a grid in those two stages gives exactly the same result as applying \(AB\) once. Since changing the order usually changes the transformation, \(AB\neq BA\) in general.</p><p class="interp"><strong>As row–column products.</strong> Entry \((i,k)\) is the dot product of row \(i\) of \(A\) and column \(k\) of \(B\).</p><p class="interp"><strong>As combinations of columns.</strong> Column \(k\) of the product is \((AB)_{:,k}=AB_{:,k}\): a linear combination of the columns of \(A\), with the entries of \(B_{:,k}\) as coefficients. These are two views of the same operation, not two different algorithms.</p><p class="hint">Play the composition and switch between \(AB\) and \(BA\) to see why order matters.</p>`,
  },
  inverse: {
    title: 'Inverse Matrices',
    lead: 'Can we undo a linear transformation? Yes—but only if it did not erase information along the way. When reversal is possible, the inverse matrix performs it.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> If \(AB=BA=I\), then \(B=A^{-1}\).</p><p class="interp"><strong>Geometrically.</strong> An inverse restores the original grid. If \(\det(A)=0\), the transformation collapses the space into a lower dimension and cannot be reversed.</p><p class="interp"><strong>For a 2×2 matrix.</strong> If \(A=\begin{bmatrix}a&b\\c&d\end{bmatrix}\), then \(A^{-1}=\frac{1}{\det A}\begin{bmatrix}d&-b\\-c&a\end{bmatrix}\), provided \(\det A\neq0\).</p><p class="hint">Apply \(A\) followed by \(A^{-1}\), then move the determinant toward zero.</p>`,
  },
  eigen: {
    title: 'Eigenvalues and Eigenvectors',
    lead: 'Most vectors change both length and direction under a transformation. Eigenvectors are the exceptional directions that stay on the same line; only their scale changes.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> A nonzero vector \(x\) is an eigenvector of \(A\) if \(Ax=\lambda x\). The scalar \(\lambda\) is the corresponding eigenvalue.</p><p class="interp"><strong>Geometrically.</strong> The vector remains on the same line. A positive eigenvalue preserves its orientation, a negative value reverses it, and zero collapses it to the origin.</p><p class="interp"><strong>Algebraically.</strong> Nonzero solutions of \((A-\lambda I)x=0\) exist when \(\det(A-\lambda I)=0\), the characteristic equation.</p><p class="interp"><strong>Why a vanishing determinant?</strong> That condition is not a new rule; it reuses the story from the inverse section. In \((A-\lambda I)x=0\), the vector \(x=0\) always works — what we want to know is whether some <em>nonzero</em> \(x\) works too. But if a matrix \(M\) sends two different inputs (\(0\) and \(x\)) to the same output \(0\), it has crushed the space and lost information, so it cannot have an inverse — and having no inverse is precisely \(\det M=0\). In short, <em>an eigenvalue is a scalar you can subtract from \(A\) to make it degenerate</em>, and \(\det(A-\lambda I)=0\) is simply "when does it degenerate?" written as an equation in \(\lambda\).</p><p class="interp"><strong>Why this matters.</strong> Along an eigenvector, matrix multiplication collapses into ordinary multiplication by a number, which makes applying \(A\) repeatedly easy: such a component grows as \(A^kx=\lambda^kx\). Decompose any vector into eigenvector components, and after many applications the direction with the largest \(|\lambda|\) dominates everything else. That is why the long-run behaviour of a repeated linear update — whether it converges or blows up, and which direction it settles into — can be read off the eigenvalues alone, and why PCA picks the leading eigenvector of the covariance matrix as the direction of greatest spread.</p><p class="hint">Move the vector onto an eigenvector direction and apply the transformation.</p>`,
  },
  subspaces: {
    title: 'The Four Fundamental Subspaces',
    lead: 'Every matrix organizes space in two ways: it separates input directions that survive from those it destroys, and output directions it can reach from those it cannot.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> For \(A\in\mathbb{R}^{m\times n}\), the row space and null space lie in \(\mathbb{R}^n\), while the column space and left null space lie in \(\mathbb{R}^m\). The first two are generated by the rows and columns; the others are \(\{x:Ax=0\}\) and \(\{y:A^\top y=0\}\).</p><p class="interp"><strong>Orthogonal structure.</strong> The input space splits orthogonally into the row space—the directions whose information survives—and the null space—the directions sent to zero. The output space splits into the reachable column space and its perpendicular complement, the left null space.</p><p class="interp"><strong>A rank-one example.</strong> For \(A=\begin{bmatrix}1&2\\3&6\end{bmatrix}\), the second row is three times the first, so \(\operatorname{rank}(A)=1\). The row space follows \((1,2)\), its null space follows \((2,-1)\), the column space follows \((1,3)\), and the left null space follows \((3,-1)\).</p><p class="interp"><strong>Intuition: surviving dimensions plus destroyed dimensions equals the input dimension.</strong> Every direction in the input space does one of two things — it leaves a trace after the map (row space) or it is crushed to zero (null space). There is no middle case and no overlap, so the two dimensions must add up to the input dimension: \(\operatorname{rank}(A)+\dim(\text{null})=n\). This is the rank–nullity theorem, and it says that "how much information is preserved" and "how much is discarded" are each other's remainder. In the example above the input is two-dimensional with rank one, so the null space has no choice but to be one-dimensional — flattening a plane onto a line sacrifices exactly one direction.</p><p class="interp"><strong>Why the split is orthogonal.</strong> Saying \(Ax=0\) is saying that <em>every row</em> of \(A\) has zero dot product with \(x\). So a null-space vector is by definition perpendicular to every row vector, and therefore to the entire space the rows generate. Orthogonality is not a decoration added afterwards; it follows immediately from the definition of the null space. Apply the same argument to \(A^\top\) and you get column space ⊥ left null space — the same sentence read once more, transposed.</p><p class="interp"><strong>Under the map.</strong> Every input decomposes into row-space and null-space components. The null component disappears, while the surviving component produces an output in the column space.</p><p class="hint">Drag the input vector to inspect its decomposition and resulting output.</p>`,
  },
  projection: {
    title: 'Orthogonality and Projection',
    lead: 'What if the vector we want does not lie in the subspace available to us? Orthogonal projection finds the closest possible substitute—a geometric idea that leads directly to least squares.',
    body: String.raw`<p class="definition"><strong>Orthogonality.</strong> Vectors \(a\) and \(b\) are orthogonal when \(a\cdot b=0\), written \(a\perp b\). A collection is orthogonal when every pair is orthogonal, and orthonormal when those vectors also have unit length.</p><p class="definition"><strong>Projection.</strong> The projection of \(b\) onto \(\operatorname{span}\{a\}\) is the point \(p=\lambda^*a\) on that line closest to \(b\). In other words, choose \(\lambda\) to minimize \(\|b-\lambda a\|\).</p><p class="definition"><strong>Orthogonal complement.</strong> For a subspace \(W\), the set \(W^\perp=\{v:v\perp w\text{ for every }w\in W\}\) contains all directions perpendicular to it. The row/null and column/left-null pairs in the previous section are exactly such complements.</p><p class="interp"><strong>Geometrically.</strong> Drop a perpendicular from \(b\) to the line spanned by \(a\). The landing point is \(p\), and \(b=p+e\) with residual \(e=b-p\) perpendicular to \(a\). If it were not perpendicular, we could move along the line to find a closer point.</p><p class="interp"><strong>Algebraically.</strong> Minimizing \(\|b-\lambda a\|^2\) gives \(\lambda^*=(a\cdot b)/(a\cdot a)\). Thus \(p=Pb\), where \(P=aa^\top/(a^\top a)\), and a projection matrix satisfies \(P^2=P=P^\top\).</p><p class="interp"><strong>Least squares.</strong> For a subspace spanned by the columns of \(A\), the projection becomes \(P=A(A^\top A)^{-1}A^\top\) when the inverse exists. If \(Ax=b\) has no exact solution, the closest attainable point is found from the normal equations \(A^\top A\hat x=A^\top b\).</p><p class="hint">Drag \(a\) and \(b\) and verify that the residual remains perpendicular to \(a\).</p>`,
  },
  invariance: {
    title: 'Invariance and Coordinate Dependence',
    lead: 'A vector and its coordinates are not the same thing. Coordinates depend on the ruler we choose, while the underlying geometric object may remain unchanged.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> A property is invariant under an operation if it remains unchanged; it is variant if its representation changes.</p><p class="interp"><strong>Transformation invariance.</strong> An eigenvector direction is invariant under \(A\) because \(Ax=\lambda x\).</p><p class="interp"><strong>Basis dependence.</strong> The coordinate lists \([v]_E\) and \([v]_B\) differ, but they describe the same vector. Distinguishing an object from its coordinates is central to linear algebra.</p>{{formula}}<p class="hint">(a) the direction is invariant; (b) there is one vector \(v\) but two coordinate lists.</p><p class="hint">Switch between the transformation and basis views.</p>`,
  },
  basis: {
    title: 'Change of Basis',
    lead: 'A change of basis is therefore a change of description, not a movement of the vector. We keep the same arrow and measure it against a new pair of axes.',
    body: String.raw`<p class="definition"><strong>Definition.</strong> Let \(B=\{b_1,b_2\}\) be a basis and \(P=[b_1\ b_2]\). The coordinate vector in basis \(B\) is \([v]_B=P^{-1}v\), while \(v=P[v]_B\).</p><p class="interp"><strong>Geometrically.</strong> The same arrow is measured against a different grid. Its coordinate values change because the unit directions have changed.</p><p class="interp"><strong>Algebraically.</strong> Solving \(P[v]_B=v\) determines the coefficients of \(v\) as a linear combination of the new basis vectors.</p><p class="hint">Drag the vector or either basis vector and observe the coordinates in the new basis.</p>`,
  },
  pytorch: {
    title: 'Connections to PyTorch',
    lead: 'These ideas are not confined to notation on a page. In PyTorch they appear as dot products, matrix multiplications, transposes, and tensor contractions—with shape and memory layout added to the picture.',
    body: String.raw`<h3>einsum</h3><p class="definition"><strong>Definition.</strong> Einstein summation describes tensor contractions by naming axes with indices. Indices repeated across inputs are multiplied; indices omitted from the output are then summed away.</p><p class="interp"><strong>An intuitive reading.</strong> Think of a tensor as a table with several axes. An einsum expression says which axes survive in the result and which ones are contracted. Dot products, outer products, matrix multiplication, and transposition are all special cases of this one notation.</p><p class="interp">For example, <code>torch.einsum('i,i-&gt;', a, b)</code> computes a dot product, <code>torch.einsum('i,j-&gt;ij', a, b)</code> an outer product, and <code>torch.einsum('ij,jk-&gt;ik', A, B)</code> matrix multiplication.</p><p class="hint">Select an equation to inspect its indices and output.</p>`,
  },
  },

  // The PyTorch section has a second .topic-text block after its demo.
  pytorchExtra: String.raw`<h3>permute, view, and reshape</h3>
  <p class="definition"><strong>permute.</strong> Reorders tensor dimensions by changing shape and strides without copying the underlying storage. For a matrix, <code>permute(1, 0)</code> is a transpose.</p>
  <p class="definition"><strong>view.</strong> Reinterprets the same storage with a different shape. The number of elements must remain fixed, and the requested shape must be compatible with the existing strides. A contiguous tensor usually permits the expected views, although non-contiguous does not automatically mean that every view must fail.</p>
  <p class="definition"><strong>reshape.</strong> Returns a view when possible and otherwise copies the data. Code should not assume that its result always shares storage with the input.</p>
  <p class="interp"><strong>A useful mental model.</strong> Picture storage as one row of boxes. <code>permute</code> changes how many boxes each logical index step jumps over; <code>view</code> regroups those same boxes when the existing step pattern allows it. <code>reshape</code> may first copy them into a compatible order.</p>
  <p class="interp"><strong>Memory layout.</strong> A contiguous tensor of shape (3, 2) has stride (2, 1). The transposed example has stride (1, 3), so its logical traversal order differs from its storage order even though the buffer itself is unchanged.</p>
  <p class="interp"><strong>Back to the mathematics.</strong> For a matrix, <code>permute(1, 0)</code> produces \(A^\top\). In a real inner-product space this transpose is the adjoint, satisfying \(\langle Ax,y\rangle=\langle x,A^\top y\rangle\). Higher-dimensional permutations follow the same index logic; whether PyTorch must copy depends on the concrete shape and strides.</p>
  <p class="hint">Compare <code>view(3, 2)</code> with <code>permute(1, 0)</code>. Their shapes agree, but their values occupy different logical positions.</p>`,

  // Applied to text outside <pre>/<code>: demo labels, buttons, static readouts.
  ui: [
  ['Python 코드로 보기', 'View Python code'],
  ['정규화 재생', 'Play normalization'],
  ['변환 재생', 'Play transformation'],
  ['초기화', 'Reset'],
  ['회전 45°', 'Rotate 45°'],
  ['전단', 'Shear'],
  ['스케일', 'Scale'],
  ['반사', 'Reflect'],
  ['순서로 합성 재생', 'composition'],
  ['전환', 'switch'],
  ['내적', 'Dot product'],
  ['외적', 'Outer product'],
  ['행렬곱', 'Matrix product'],
  ['전치', 'Transpose'],
  ['실제 메모리 버퍼 (항상 이 순서 그대로, 절대 안 바뀜)', 'Underlying memory buffer (storage order)'],
  ['초기화 x (2,3)', 'Reset x (2,3)'],
  ['같은 θ를 단위원에서 본 cosθ · sinθ · tanθ', 'cosθ, sinθ, and tanθ on the unit circle'],
  ['임베딩 정규화(L2): 크기 제각각인 벡터들 → 전부 단위원 위(방향만 남음)', 'L2 embedding normalization: vectors with different magnitudes → unit circle'],
  ['확률분포 정규화(L1): 원시 양수 점수 → 합이 1인 분포(대각선 위)', 'L1 probability normalization: positive scores → distribution summing to one'],
  ['t=0: 정규화 전 (크기 제각각) &nbsp;·&nbsp; t=1: 정규화 후 (전부 단위원 위)', 't=0: before normalization &nbsp;·&nbsp; t=1: vectors on the unit circle'],
  ['t=0: 원시 점수 (합 제각각) &nbsp;·&nbsp; t=1: 확률분포 (합 = 1)', 't=0: raw scores &nbsp;·&nbsp; t=1: probability distribution (sum = 1)'],
  ['A → A⁻¹ 재생', 'Play A → A⁻¹'],
  ['변환에 대한 불변', 'Transformation invariance'],
  ['기저에 대한 불변', 'Basis dependence'],
  ['넓이', 'area'],
  ['proj 길이', 'projection length'],
  ['선형독립의 정의', 'definition of linear independence'],
  // Initial values of the readouts under each demo. The wording matches the
  // isEnglish branches in interactive.js, so hydration does not visibly
  // rewrite them on first paint.
  ['선형독립 · span 차원', 'independent · span dimension'],
  ['A⁻¹ 존재', 'A⁻¹ exists'],
  ['(1,1) 방향은 A를 적용해도 그대로 — 고유벡터입니다.', 'Only the (1,1) and (1,-1) directions are invariant; move q onto a dashed line.'],
  ['v (표준좌표)', 'v (standard coordinates)'],
  ['[v]_B (새 기저 좌표)', '[v]_B'],
  ],

  // Applied only inside <pre><code>, so identifiers are never touched.
  codeComments: [
  ['화살표를 이어 붙이는 덧셈', 'addition: arrows placed tip to tail'],
  ['스칼라배', 'scalar multiplication'],
  ['L2(기본값): 3.6056', 'L2 (default): 3.6056'],
  ['r 방향으로의 정사영 길이', 'projection length onto the direction of r'],
  ['(평행사변형 넓이)', '(parallelogram area)'],
  ['열벡터 a1=(1,3), a2=(2,4)', 'columns a1=(1,3), a2=(2,4)'],
  ['rank 2 -> 선형독립, 기저', 'rank 2 -> independent, a basis'],
  ['v1의 배수', 'a multiple of v1'],
  ['rank 1 -> 선형종속', 'rank 1 -> dependent'],
  ['선형함수', 'a linear function'],
  ['항상 같다 ->', 'always equal ->'],
  ['아핀: 선형이 아님', 'affine, not linear'],
  ['다르다 ->', 'not equal ->'],
  ['같다: 합성 = 곱한 행렬을 한 번에 적용', 'equal: composing = applying the product once'],
  ['5.0, 0이면 역행렬 없음', '5.0; no inverse when this is 0'],
  ['각 열이 고유벡터:', 'each column is an eigenvector:'],
  ['영공간 기저', 'basis of the null space'],
  ['좌영공간 기저', 'basis of the left null space'],
  ['(직교)', '(orthogonal)'],
  ['정사영 행렬', 'projection matrix'],
  ['p와 동일', 'same as p'],
  ['최소제곱: Ax=b에 정확한 해가 없을 때', 'least squares: when Ax=b has no exact solution'],
  ['정규방정식', 'normal equations'],
  ['방향 불변', 'direction unchanged'],
  ['방향이 꺾임(가변)', 'direction changes'],
  ['새 기저 좌표', 'coordinates in the new basis'],
  ['표준좌표', 'standard coordinates'],
  ['메모리 순서 그대로 재해석', 'same storage, reinterpreted'],
  ['진짜 전치, 값 배치가 다름!', 'a real transpose: the values move'],
  ['.view() 불가, .reshape()는 복사해서 동작', '.view() fails; .reshape() copies instead'],
  ['행렬곱, A @ B 와 동일', 'matrix product, same as A @ B'],
  ['trace = 고유값의 합', 'trace = sum of the eigenvalues'],
  ['내적 = 32.0', 'dot product = 32.0'],
  ],
};
