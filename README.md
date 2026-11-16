# 物业管理系统（Web 后台）

## 启动后端
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python seed.py                 # 初始化示例数据
uvicorn app.main:app --reload --port 8000
# 接口文档：http://127.0.0.1:8000/docs

## 启动前端
cd frontend
npm install
npm run dev                    # http://localhost:5173

账号：admin / manager / cashier / repair01 / finance，密码 123456

## 角色权限
admin 全部；manager 房屋/账单/报修全权；cashier 房屋只读、账单收款；repairman 只看派给自己的工单并处理。
