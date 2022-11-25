/*
线性代数运算器
该文件的编写受函数式编程思维的启发
本质是定义了一个函子，用于实现向量和矩阵计算的链式调用
可以将这些线性代数的计算视为运算符，作为表达式肯定有可以视为输入和输出的操作数
运算器函子可以将向量/矩阵绑定到运算符的输入/输出中

defineLineAlge(type, arithmetics) 函数可以定义一个线性代数集合。
    type: String 该线代数据的类型 用于链式调用时遇到不同类型的输入输出不用中断链式写法
        例如 mat4.getScaling 会返回 vec3，此时可以接着使用vec3运算器
    arithmetics: { fnName : fnInfo } 用于批量定义运算符
        fnName 运算符名
        fnInfo: { alias: [String], fn: Function, ... } 运算符信息
            alias: 运算符的别名 （调用效率一样，可以放心使用）
            fn: 运算符实际函数体
            ...: 参考下面的_define函数参数的定义
    return: Function 运算器函子生成器solver
        solver本身是个函数，定义的线代运算符会作为方法添加到该函数上
        函数执行时返回一个函子以实现链式调用
        函子本质上是Proxy 根据预设好的运算符信息来调用运算符
        solver本身带有一个_define函数，用于定义单个运算符
solver._define(names, fn, fnInfo)
    names: String | [String] 运算符名称 可以多名称对应同一运算符
    fn: Function 运算符实际函数体
    fnInfo: {
        input: Number = 1 输入参数的位置 0 为无输入参数 -1 为最后一个
        output: Number = -1 输出参数的位置 0 为无输出参数 -1 为最后一个
        outputType: String = type 输出类型，用于运算器函子的链式调用，和defineLineAlge函数的第一个参数相关
        argsLen: Number = fn.length + 1 参数列表的长度，由于默认参数之前的参数才计入Function.prototype.length，所以并不一定准确。本项目中一般来说最后一个是输出，故+1。
        derived: Object = { 衍生函数 提高函数复用率 用于非单目运算符 绑定不同位置的参数作为输入
            fn: Function 如果为空则和源一样 否则 将运算符列表和运算符的运行结果作为最后一个参数来执行
            input 缺省和源函数一样
            output 缺省和源函数一样
            alias: [String] = []
        }
        return: solver
    }
*/

const solvers = {};
function defineLineAlge(type, emptyValue = Array, arithmetics = {}) {
    if (type in solvers) return solvers[type];
    const aris = {};
    const solver = solvers[type] = (operand = emptyValue(), asInput = true, asOutput = true) => {
        let proxy = new Proxy(operand, {
            get(operand, propKey, that) {
                // 本来这里根据FP思想应该返回一个新的solver实例的 但为了减少无用内存的产生就不这么做了
                if (propKey in aris) {
                    const operator = aris[propKey];
                    return (...args) => {
                        let { input, output } = operator;
                        input < output
                            ? (input && asInput
                                ? (args.splice(input - 1, 0, operand) && (
                                    asOutput && args.splice(output + 1, 0, operand)))
                                : (asOutput && args.splice(output, 0, operand)))
                            : (input && asInput
                                ? (args.splice(input - 1, 0, operand) && (
                                    asOutput && args.splice(output + 1, 0, operand)))
                                : (asOutput && args.splice(output, 0, operand)));
                        let res = operator(...args);
                        return asOutput? proxy
                            : (solvers[operator.outputType](res, asInput, asOutput)
                                || solvers[type](res, asInput, asOutput));
                    };
                }
                else switch (propKey) {
                    case "b2i": case "bind2in": asInput = true; return proxy;
                    case "b2o": case "bind2out": asOutput = true; return proxy;
                    case "ub2i": case "unbind2in": asInput = false; return proxy;
                    case "ub2o": case "unbind2out": asOutput = false; return proxy;
                    case "ans": case "answer": case "res": case "result": return operand;
                    default: return Reflect.get(operand, propKey, that);
                }
            },
        });
        return proxy;
    };

    // 定义一个运算符
    solver._define = function(names, fn, {
        input = 1, output = -1, outputType = type,
        argsLen = fn.length + 1, derived = {},
    } = {}) {
        if (typeof names === "string") names = [names];
        fn.argsLen = argsLen;
        fn.input = input < 0? argsLen + input + 1: input;
        fn.output = output < 0? argsLen + output + 1: output;
        fn.outputType = outputType;
        names.forEach(name => {
            Object.defineProperty(solver, name, {
                value: fn, configurable: true, writable: true, enumerable: true,
            });
            aris[name] = fn;
        });
        Object.entries(derived).forEach(([name, {
            fn: dfn, input: dinput = input, output: doutput = output, alias = [],
        }]) => {
            const derivedFn = dfn? (...args) => dfn(...args, fn(...args)): fn.bind();
            derivedFn.input = dinput < 0? argsLen + dinput + 1: dinput;
            derivedFn.output = doutput < 0? argsLen + doutput + 1: doutput;
            derivedFn.outputType = outputType;
            aris[name] = derivedFn;
            alias.forEach(name => aris[name] = derivedFn);
        });
        return solver;
    };

    Object.entries(arithmetics).forEach(([fnName, fnInfo]) => {
        const names = fnInfo.alias || [];
        names.unshift(fnName);
        solver._define(names, fnInfo.fn, fnInfo);
    });

    return solver;
}

export {
    defineLineAlge as default,
    defineLineAlge,
};

/*
    为何编写这个文件：
    之前实现的是一个命令式的线代运算工具库。工具库虽好，但在编写的时候有许多写法上的冗余（没错就是懒）。
    后来想到链式调用可以减少很多冗余。

    作为解决方案首先想到的是面向对象。在将所有的工具库都封装成了对象后，又出现两个问题：
    1) 不够灵活。将工具封装到特定类的实例中，这意味着要使用特定工具则需要类型相符。比如说：
        将所有的三维向量运算封装到 class Vec3 {} 中。使用时: a = new Vec3([x, y, z])，运算：a.add(b)
        那如果需要对普通的向量数组进行相关的向量运算时，不仅需要用Vec3包装一层，还需要考虑如何处理运算结果。
        虽然将所有向量都变为Vec3类型，减少了编写自由度，带来更少的bug，但这样会再次引入编写时冗余这个问题，违背初衷。
        【毕竟直接一个[x,y,z]肯定更爽更舒服啊。
    2) 且会在运行时产生很多垃圾。
        由于需要实时渲染，而js引擎会不定期执行gc，若垃圾内存较多会导致gc要花费较长时间回收内存，会时不时掉帧。
    
    重新审视整个过程，咱既想维持灵活便捷的特性，同时也要减少垃圾内存的产生。
    在面向对象时，对象总是作为线代运算符的一个操作数。
    同时为了减少垃圾内存的产生，将运算结果写回this是一个很好的思路，事实上咱也是这么干的。
        > 比如说: a = a + b + c 会写成 a = a.add(b).add(c) 或者根据结合律 a.add(b.add(c))
        > 如果不将结果写回this则会在运算过程中产生2个临时变量
        > 另个例子：a = b + c 会写成 a = b.clone().add(c) 这个过程中clone生成的新内存最终被a捕获并在未来使用，所以并不算垃圾。
    换句话说，面向对象解决方案的本质不过是将工具库中每个函数的输入和输出都固定了，这不过是将所有的函数都转变成了偏函数。

    借助函数式编程中函子的思想，将过程封装起来，形成类似数据流一样的结构，从而能完成链式调用的目的。
*/
