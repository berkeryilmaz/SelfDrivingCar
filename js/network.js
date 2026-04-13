export class Network {
    constructor(inputSize = 8, outputSize = 9, hiddenSizes = [64, 64], lr = 0.001) {
        this.inputSize = inputSize;
        this.outputSize = outputSize;
        this.hiddenSizes = hiddenSizes;
        this.lr = lr;
        this.layerSizes = [inputSize, ...hiddenSizes, outputSize];
        this.model = this.buildModel();
        this.targetModel = this.buildModel();
        this.updateTargetNetwork();
        this.lastActivations = [];
        this.lastWeights = [];
        this.disposed = false;
    }

    buildModel() {
        const model = tf.sequential();
        model.add(tf.layers.dense({
            inputShape: [this.inputSize],
            units: this.hiddenSizes[0],
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }));
        for (let i = 1; i < this.hiddenSizes.length; i++) {
            model.add(tf.layers.dense({
                units: this.hiddenSizes[i],
                activation: 'relu',
                kernelInitializer: 'heNormal'
            }));
        }
        model.add(tf.layers.dense({
            units: this.outputSize,
            activation: 'linear'
        }));
        model.compile({
            optimizer: tf.train.adam(this.lr),
            loss: 'meanSquaredError'
        });
        return model;
    }

    updateTargetNetwork() {
        if (this.disposed) return;
        const sourceWeights = this.model.getWeights();
        const cloned = sourceWeights.map(w => w.clone());
        this.targetModel.setWeights(cloned);
        cloned.forEach(w => w.dispose());
    }

    predict(state) {
        if (this.disposed) return null;
        return tf.tidy(() => {
            const input = tf.tensor2d([state]);
            return this.model.predict(input);
        });
    }

    predictTarget(states) {
        if (this.disposed) return null;
        return tf.tidy(() => {
            const input = tf.tensor2d(states);
            return this.targetModel.predict(input);
        });
    }

    async train(states, targets) {
        if (this.disposed) return;
        const xs = tf.tensor2d(states);
        const ys = tf.tensor2d(targets);
        await this.model.fit(xs, ys, {
            epochs: 1,
            batchSize: states.length,
            verbose: 0
        });
        xs.dispose();
        ys.dispose();
    }

    extractActivations(state) {
        if (this.disposed) return this.lastActivations;
        return tf.tidy(() => {
            const activations = [state.slice()];
            let current = tf.tensor2d([state]);

            for (let i = 0; i < this.model.layers.length; i++) {
                current = this.model.layers[i].apply(current);
                activations.push(Array.from(current.dataSync()));
            }

            this.lastActivations = activations;
            return activations;
        });
    }

    extractWeightsForVis() {
        if (this.disposed) return this.lastWeights;
        return tf.tidy(() => {
            const weights = [];
            for (let i = 0; i < this.model.layers.length; i++) {
                const layerWeights = this.model.layers[i].getWeights();
                if (layerWeights.length > 0) {
                    const kernelData = layerWeights[0].dataSync();
                    const shape = layerWeights[0].shape;
                    weights.push({
                        data: Array.from(kernelData),
                        shape: shape
                    });
                }
            }
            this.lastWeights = weights;
            return weights;
        });
    }

    setLearningRate(lr) {
        if (this.disposed) return;
        this.lr = lr;
        this.model.compile({
            optimizer: tf.train.adam(lr),
            loss: 'meanSquaredError'
        });
    }

    getArchString() {
        return this.layerSizes.join(' → ');
    }

    dispose() {
        this.disposed = true;
        this.model.dispose();
        this.targetModel.dispose();
    }
}

