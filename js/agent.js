import { Network } from './network.js';

export class Agent {
    constructor(stateSize = 8, actionSize = 9) {
        this.stateSize = stateSize;
        this.actionSize = actionSize;
        this.network = new Network(stateSize, actionSize, [64, 64], 0.001);

        this.epsilon = 1.0;
        this.epsilonMin = 0.05;
        this.epsilonDecay = 0.9995;
        this.gamma = 0.99;
        this.batchSize = 64;
        this.replayBuffer = [];
        this.maxBufferSize = 50000;
        this.targetUpdateFreq = 500;
        this.trainStepCount = 0;

        this.actions = this.buildActionSpace();
    }

    buildActionSpace() {
        const steerings = [-1, 0, 1];
        const throttles = [0.3, 0.6, 1.0];
        const actions = [];
        for (const s of steerings) {
            for (const t of throttles) {
                actions.push({ steer: s, throttle: t });
            }
        }
        return actions;
    }

    chooseAction(state) {
        if (Math.random() < this.epsilon) {
            return Math.floor(Math.random() * this.actionSize);
        }

        const qValues = this.network.predict(state);
        const actionIdx = qValues.argMax(1).dataSync()[0];
        qValues.dispose();
        return actionIdx;
    }

    getAction(actionIdx) {
        return this.actions[actionIdx];
    }

    remember(state, action, reward, nextState, done) {
        this.replayBuffer.push({ state, action, reward, nextState, done });
        if (this.replayBuffer.length > this.maxBufferSize) {
            this.replayBuffer.shift();
        }
    }

    async replay() {
        if (this.replayBuffer.length < this.batchSize) return;

        const batch = [];
        for (let i = 0; i < this.batchSize; i++) {
            const idx = Math.floor(Math.random() * this.replayBuffer.length);
            batch.push(this.replayBuffer[idx]);
        }

        const states = batch.map(e => e.state);
        const nextStates = batch.map(e => e.nextState);

        const currentQs = this.network.predict(states[0]);
        const allCurrentQs = tf.tidy(() => {
            return this.network.model.predict(tf.tensor2d(states));
        });
        const allNextQs = this.network.predictTarget(nextStates);

        const currentQData = allCurrentQs.arraySync();
        const nextQData = allNextQs.arraySync();

        currentQs.dispose();
        allCurrentQs.dispose();
        allNextQs.dispose();

        const targets = [];
        for (let i = 0; i < this.batchSize; i++) {
            const target = currentQData[i].slice();
            if (batch[i].done) {
                target[batch[i].action] = batch[i].reward;
            } else {
                const maxNextQ = Math.max(...nextQData[i]);
                target[batch[i].action] = batch[i].reward + this.gamma * maxNextQ;
            }
            targets.push(target);
        }

        await this.network.train(states, targets);

        this.trainStepCount++;
        if (this.trainStepCount % this.targetUpdateFreq === 0) {
            this.network.updateTargetNetwork();
        }

        this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
    }

    setEpsilon(val) {
        this.epsilon = val;
    }

    setLearningRate(lr) {
        this.network.setLearningRate(lr);
    }

    setGamma(gamma) {
        this.gamma = gamma;
    }

    dispose() {
        this.network.dispose();
    }
}
