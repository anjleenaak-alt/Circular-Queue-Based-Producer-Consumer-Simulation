from flask import Flask, jsonify, request
from flask_cors import CORS
from threading import Lock

app = Flask(__name__)
CORS(app)

# Thread-safe circular queue implementation
class CircularQueue:

    def __init__(self, capacity=6):
        self.lock = Lock()
        self.reset(capacity)

    def reset(self, capacity=6):
        with self.lock:
            self.capacity = capacity
            self.buffer = [None] * capacity

            self.front = -1
            self.rear = -1
            self.size = 0

            self.total_produced = 0
            self.total_consumed = 0

    def enqueue(self, item):
        with self.lock:

            # Check whether the queue is full
            if self.size == self.capacity:
                return False, "Buffer is full! Producer must wait."

            # First insertion
            if self.size == 0:
                self.front = 0
                self.rear = 0
            else:
                # Circular wraparound
                self.rear = (self.rear + 1) % self.capacity

            self.buffer[self.rear] = item
            self.size += 1
            self.total_produced += 1

            return True, f"Produced {item} successfully."

    def dequeue(self):
        with self.lock:

            # Check whether the queue is empty
            if self.size == 0:
                return False, "Buffer is empty! Consumer must wait."

            # Remove the oldest item
            item = self.buffer[self.front]
            self.buffer[self.front] = None

            self.size -= 1
            self.total_consumed += 1

            if self.size == 0:
                self.front = -1
                self.rear = -1
            else:
                # Circular wraparound
                self.front = (self.front + 1) % self.capacity

            return True, f"Consumed {item} successfully."

    def get_state(self):
        with self.lock:
            return {
                "buffer": self.buffer.copy(),
                "capacity": self.capacity,
                "front": self.front,
                "rear": self.rear,
                "size": self.size,
                "total_produced": self.total_produced,
                "total_consumed": self.total_consumed
            }


queue = CircularQueue(6)


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Circular Queue Producer-Consumer API",
        "status": "running"
    })


@app.route("/api/state", methods=["GET"])
def get_state():
    return jsonify(queue.get_state())


@app.route("/api/produce", methods=["POST"])
def produce():
    item = f"Packet-{queue.get_state()['total_produced'] + 1}"

    success, message = queue.enqueue(item)

    return jsonify({
        "success": success,
        "message": message,
        "state": queue.get_state()
    }), 200


@app.route("/api/consume", methods=["POST"])
def consume():
    success, message = queue.dequeue()

    return jsonify({
        "success": success,
        "message": message,
        "state": queue.get_state()
    }), 200


@app.route("/api/reset", methods=["POST"])
def reset():
    data = request.get_json(silent=True) or {}

    try:
        capacity = int(data.get("capacity", 6))
    except (ValueError, TypeError):
        return jsonify({"error": "Capacity must be an integer."}), 400

    if not 2 <= capacity <= 10:
        return jsonify({
            "error": "Capacity must be between 2 and 10."
        }), 400

    queue.reset(capacity)

    return jsonify({
        "success": True,
        "message": f"Buffer reset to {capacity} slots.",
        "state": queue.get_state()
    })


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )