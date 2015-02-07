
import { resolve } from 'rus-diff'

function isvalue (a) {
  return a !== undefined && a !== null
}

function* kvs (a) {
  for (let k of Object.keys(a)) {
    if (a.hasOwnProperty(k)) {
      yield [k, a[k]]
    }
  }
}

function isdeep (a, b) {
  var as, bs, i, k, sf, v, _i, _len, _ref;
  if ((a !== null) && (b !== null) && (typeof a === 'object') && (typeof b === 'object')) {
    as = (function() {
      var _results;
      _results = [];
      for (k in a) {
        if (!__hasProp.call(a, k)) continue;
        v = a[k];
        _results.push({
          k: k,
          v: v
        });
      }
      return _results;
    })();
    bs = (function() {
      var _results;
      _results = [];
      for (k in b) {
        if (!__hasProp.call(b, k)) continue;
        v = b[k];
        _results.push({
          k: k,
          v: v
        });
      }
      return _results;
    })();
    if (as.length === bs.length) {
      sf = function(x, y) {
        return x.k > y.k;
      };
      as.sort(sf);
      bs.sort(sf);
      for (i = _i = 0, _len = as.length; _i < _len; i = ++_i) {
        _ref = as[i], k = _ref.k, v = _ref.v;
        if (!(isdeep(k, bs[i].k) && isdeep(v, bs[i].v))) {
          return false;
        }
      }
      return true;
    } else {
      return false;
    }
  } else {
    return a === b;
  }
}

class Criteria {

  constructor () {
    this.registry = {
      transforms: [],
      conditions: [],
      expansions: []
    }
  }

  append (t, k, f) {
    this.registry[t].push([ k, f ])
  }

  prepend (t, k, f) {
    this.registry[t].shift([ k, f ])
  }

  // Find rule with k name.
  rule (k) {
    let r = [ undefined, undefined ]
    for (let [ tk, tv ] of kvs(this.registry)) {
      for (let [ rk, rf ] of tv) {
        if (k === rk) {
          r = [ tk, rf ]
          break;
        }
      }
    }
    return r
  }

  test (d, q) {
    let r = true
    for (let [ qk, qv ] of kvs(q)) {
      if (qk[0] === '$') {

        let [ t, f ] = this.rule(qk)

        switch (t) {

          case 'expansions':
            r = r && this.test(d, f)
            break

          case 'transforms':
            r = r && this.test(f.bind(this)(d, qv), qv)
            break

          case 'conditions':
            r = r && f.bind(this)(d, qv, q)
            break

          default:
            throw new Error(`Unknown rule ${qk}`)

        }

        if (r === false) {
          break
        }
      } else {
        let [ dvp, dk ] = resolve(d, qk)
        if (dvp !== null && dk.length === 1) { // ...it's resolved
          r = r && this.test(dvp[dk[0]], qv)
        } else {
          r = r && this.test(undefined, v) // we can still match `{ $exists: false }`, possibly in nested `{ $or: [] }`.
        }
      }
    }
    return r
  }

}

let c = new Criteria()

// Logical ops.

c.append('conditions', '$and', (a) => { return a.reduce(((p, c) => p && this.test(a, c)), true) })
c.append('conditions', '$or', (a) => { return a.reduce(((p, c) => p || this.test(a, c)), false) })
c.append('conditions', '$nor', (a) => { return a.reduce(((p, c) => p && !this.test(a, c)), true) })
c.append('conditions', '$not', (a) => { return !this.test(a, c) })

// Equality ops.

c.append('conditions', '$eq', (a, b) => isdeep(a, b) )
c.append('conditions', '$ne', (a, b) => !isdeep(a, b) )
c.append('conditions', '$lt', (a, b) => a < b )
c.append('conditions', '$lte', (a, b) => a <= b )
c.append('conditions', '$gt', (a, b) => a > b )
c.append('conditions', '$gte', (a, b) => a > b )
c.append('conditions', '$in', (a, b) => { let aa = arrize(a); arrize(b).some((e) => e in aa) } )
c.append('conditions', '$nin', (a, b) => { let aa = arrize(a); arrize(b).every((e) => !(e in aa)) } )

c.append('conditions', '$exists', (a, b) => a ^ isvalue(b) )
c.append('conditions', '$typeof', (a, b) => typeof(a) === b )

c.append('conditions', '$regex', (a, b, c) => !!a.match(new RegExp(b, c.$options)) )

c.append('expansions', '$email', { $typeof: 'string', $regex: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i } )

c.append('transforms', '$length', (a) => {
  let r = undefined
  let t = typeof(a)
  if (t === 'string' || (t === 'object' && a !== null && a.hasOwnProperty('length'))) {
    r = a.length
  }
  return r
})

export function test (a, q) {
  return c.test(a, q)
}
