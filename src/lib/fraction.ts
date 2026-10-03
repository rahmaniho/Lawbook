/** کسر گویا برای محاسبات دقیق سهم‌الارث و دیه (بدون خطای ممیز شناور) */
function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a || 1
}

export class Fraction {
  readonly n: number
  readonly d: number
  constructor(n: number, d = 1) {
    if (d === 0) throw new Error('مخرج صفر')
    if (d < 0) {
      n = -n
      d = -d
    }
    const g = gcd(n, d)
    this.n = n / g
    this.d = d / g
  }
  static of(n: number, d = 1) {
    return new Fraction(n, d)
  }
  static ZERO = new Fraction(0, 1)
  static ONE = new Fraction(1, 1)
  add(o: Fraction) {
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d)
  }
  sub(o: Fraction) {
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d)
  }
  mul(o: Fraction | number) {
    const f = typeof o === 'number' ? new Fraction(o) : o
    return new Fraction(this.n * f.n, this.d * f.d)
  }
  div(o: Fraction | number) {
    const f = typeof o === 'number' ? new Fraction(o) : o
    return new Fraction(this.n * f.d, this.d * f.n)
  }
  cmp(o: Fraction) {
    return this.n * o.d - o.n * this.d
  }
  isZero() {
    return this.n === 0
  }
  toNumber() {
    return this.n / this.d
  }
  toString() {
    return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`
  }
}

export const sum = (list: Fraction[]) => list.reduce((a, b) => a.add(b), Fraction.ZERO)
